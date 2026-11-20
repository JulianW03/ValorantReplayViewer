import { AsyncResult } from '@vrv/shared';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { DataViewable } from '@/core/data/interfaces/capabilities/DataViewable';
import { KeyDataViewable } from '@/core/data/interfaces/capabilities/KeyDataViewable';
import { DataDeletable } from '@/core/data/interfaces/capabilities/DataDeletable';

const TIMED_OUT = Symbol('TIMED_OUT');
type TimedOut = typeof TIMED_OUT;

export type AsyncMapBackable<K extends PropertyKey, V, E extends Error> =
    DataViewable<Record<K, AsyncResult<V, E>>>
    & KeyDataViewable<K, AsyncResult<V, E>>
    & DataDeletable;

export class AsyncMapDataBehavior<
    K extends PropertyKey,
    V,
    E extends Error,
> implements AsyncMapBackable<K, V, E> {
    private readonly pending = new Map<K, Promise<V>>();
    private resetMarker = 0;

    public constructor(
        protected readonly externalRepresentation: IMapDataManager<
            K,
            AsyncResult<V, E>,
            AsyncResult<V, E>
        >,
    ) {
    }

    protected injectPromise(key: K, promise: Promise<V>): boolean {
        if (this.pending.has(key)) {
            return false;
        }

        const currentMarker = this.resetMarker;

        const using = promise
            .then(data => {
                if (this.resetMarker === currentMarker) {
                    this.externalRepresentation.updateKeyValue(
                        key,
                        AsyncResult.success(data),
                    );
                }

                return data;
            })
            .catch(error => {
                if (this.resetMarker === currentMarker) {
                    const normalizedError =
                        error instanceof Error
                            ? error
                            : new Error(String(error));

                    this.externalRepresentation.updateKeyValue(
                        key,
                        AsyncResult.failure(normalizedError as E),
                    );
                }

                throw error;
            });

        this.pending.set(key, using);

        this.externalRepresentation.updateKeyValue(
            key,
            AsyncResult.pending(),
        );

        // `using` is intentionally kept rejected for getResult() callers, but a
        // fetch triggered by an event may have no such caller. Without a terminal
        // handler here that rejection escapes as an unhandledRejection and takes
        // the process down. The failure is still observable via AsyncResult.failure()
        // and via any getResult()/getBestEffortBatchedResult() consumer of `using`.
        using
            .catch(() => undefined)
            .finally(() => {
            });

        return true;
    }

    private awaitBestEffort(
        promise: Promise<V>,
        timeoutMs?: number,
    ): Promise<V | TimedOut> {
        if (!timeoutMs) {
            return promise;
        }

        return new Promise<V | TimedOut>((resolve, reject) => {
            const timer = setTimeout(() => {
                resolve(TIMED_OUT);
            }, timeoutMs);

            promise.then(
                value => {
                    clearTimeout(timer);
                    resolve(value);
                },
                error => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        });
    }

    public getResult(key: K, timeoutMs?: number): Promise<V> {
        const promise = this.pending.get(key);

        if (!promise) {
            return Promise.reject(
                new Error(`No pending fetch for key ${String(key)}`),
            );
        }

        return timeoutMs
            ? this.awaitBestEffort(promise, timeoutMs).then(result => {
                  if (result === TIMED_OUT) {
                      throw new Error(
                          `Fetch timed out for key ${String(key)}`,
                      );
                  }

                  return result;
              })
            : promise;
    }

    public async getBestEffortBatchedResult(
        keys: K[],
        timeoutMs?: number,
    ): Promise<Record<K, V | null>> {
        await Promise.all(
            keys.map(async key => {
                const promise = this.pending.get(key);

                if (!promise) {
                    console.log("No pending fetch for key", key);
                    return;
                }

                try {
                    await this.awaitBestEffort(promise, timeoutMs);
                } catch {
                    // Individual failures are represented by AsyncResult.failure().
                    // Best-effort batching should not fail because one request failed.
                }
            }),
        );

        const result = {} as Record<K, V | null>;

        for (const key of keys) {
            const view = this.externalRepresentation.getKeyView(key);

            if (view?.isSuccess()) {
                result[key] = view.data;
            } else {
                result[key] = null;
            }
        }

        return result;
    }

    public getKeyView(key: K): AsyncResult<V, E> | null {
        return this.externalRepresentation.getKeyView(key);
    }

    public getView(): Record<K, AsyncResult<V, E>> | null {
        return this.externalRepresentation.getView();
    }

    public deleteState(): void {
        this.resetMarker++;
        this.pending.clear();
    }
}