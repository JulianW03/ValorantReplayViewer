import { AsyncMapDataBehavior } from '@/core/data/behaviors/async/AsyncMapDataBehavior';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { AsyncResult, Success } from '@vrv/shared';
import { TimeoutError } from '@/utils/PromiseUtils';
import { beforeEach, describe, expect, it } from 'vitest';

class TestableAsyncMapBehavior extends AsyncMapDataBehavior<string, string, Error> {
    public inject(key: string, promise: Promise<string>): boolean {
        return this.injectPromise(key, promise);
    }
}

function makeSetup() {
    const inner = new SimpleMapDataManager<string, AsyncResult<string, Error>>();
    const behavior = new TestableAsyncMapBehavior(inner);
    return { inner, behavior };
}

describe('AsyncMapDataBehavior', () => {
    describe('injectPromise', () => {
        it('sets the key to Pending immediately', () => {
            const { behavior } = makeSetup();
            behavior.inject('key', new Promise(() => {}));
            expect(behavior.getKeyView('key')?.isPending()).toBe(true);
        });

        it('returns true on the first inject for a key', () => {
            const { behavior } = makeSetup();
            const result = behavior.inject('key', new Promise(() => {}));
            expect(result).toBe(true);
        });

        it('returns false when the key is already pending', () => {
            const { behavior } = makeSetup();
            behavior.inject('key', new Promise(() => {}));
            const second = behavior.inject('key', Promise.resolve('ignored'));
            expect(second).toBe(false);
        });

        it('transitions the key to Success after the promise resolves', async () => {
            const { behavior } = makeSetup();
            behavior.inject('key', Promise.resolve('hello'));
            await new Promise(r => setTimeout(r, 0));
            const view = behavior.getKeyView('key');
            expect(view?.isSuccess()).toBe(true);
            expect((view as Success<string, Error>).data).toBe('hello');
        });

        it('transitions the key to Failure after the promise rejects', async () => {
            const { behavior } = makeSetup();
            behavior.inject('key', Promise.reject(new Error('boom')));
            await new Promise(r => setTimeout(r, 0));
            expect(behavior.getKeyView('key')?.isFailure()).toBe(true);
        });
    });

    describe('deleteState', () => {
        it('prevents in-flight promise resolutions from updating state', async () => {
            const { behavior } = makeSetup();
            let resolve!: (v: string) => void;
            const promise = new Promise<string>(r => { resolve = r; });
            behavior.inject('key', promise);

            behavior.deleteState();
            resolve('late');
            await new Promise(r => setTimeout(r, 0));

            expect(behavior.getKeyView('key')?.isPending()).toBe(true);
        });

        it('clears the pending map so getResult rejects for previously tracked keys', async () => {
            const { behavior } = makeSetup();
            behavior.inject('key', new Promise(() => {}));
            behavior.deleteState();
            await expect(behavior.getResult('key')).rejects.toThrow();
        });

        it('allows a key to be injected again after deleteState', () => {
            const { behavior } = makeSetup();
            behavior.inject('key', new Promise(() => {}));
            behavior.deleteState();
            const result = behavior.inject('key', Promise.resolve('fresh'));
            expect(result).toBe(true);
        });
    });

    describe('getResult', () => {
        it('resolves with the value when the promise succeeds', async () => {
            const { behavior } = makeSetup();
            behavior.inject('key', Promise.resolve('world'));
            await expect(behavior.getResult('key')).resolves.toBe('world');
        });

        it('rejects for a key that was never injected', async () => {
            const { behavior } = makeSetup();
            await expect(behavior.getResult('missing')).rejects.toThrow('No pending fetch for key missing');
        });

        it('rejects with Error when the promise does not settle within the timeout', async () => {
            const { behavior } = makeSetup();
            behavior.inject('key', new Promise(() => {}));
            await expect(behavior.getResult('key', 20)).rejects.toBeInstanceOf(Error);
        }, 1000);
    });

    describe('getBestEffortBatchedResult', () => {
        it('returns only the keys whose promises resolved successfully', async () => {
            const { behavior } = makeSetup();
            behavior.inject('a', Promise.resolve('valA'));
            behavior.inject('b', Promise.reject(new Error('fail')));
            const result = await behavior.getBestEffortBatchedResult(['a', 'b']);
            expect(result).toHaveProperty('a', 'valA');
            expect(result).toHaveProperty('b', null);
        });

        it('returns all keys when every promise resolves', async () => {
            const { behavior } = makeSetup();
            behavior.inject('x', Promise.resolve('1'));
            behavior.inject('y', Promise.resolve('2'));
            const result = await behavior.getBestEffortBatchedResult(['x', 'y']);
            expect(result).toEqual({ x: '1', y: '2' });
        });

        it('Returns all null when all promises fail', async () => {
            const { behavior } = makeSetup();
            behavior.inject('a', Promise.reject(new Error('e1')));
            behavior.inject('b', Promise.reject(new Error('e2')));
            const result = await behavior.getBestEffortBatchedResult(['a', 'b']);
            expect(result).toHaveProperty('a', null);
            expect(result).toHaveProperty('b', null);
        });

        it('Returns values that returned in time, otherwise null', async () => {
            const { behavior } = makeSetup();
            behavior.inject('fast', Promise.resolve('done'));
            behavior.inject('slow', new Promise(() => {}));
            const result = await behavior.getBestEffortBatchedResult(['fast', 'slow'], 50);
            expect(result).toHaveProperty('fast', 'done');
            expect(result).toHaveProperty('slow', null);
        }, 1000);

        it('Returns null for keys that were never injected', async () => {
            const { behavior } = makeSetup();
            behavior.inject('known', Promise.resolve('ok'));
            const result = await behavior.getBestEffortBatchedResult(['known', 'unknown']);
            expect(result).toHaveProperty('known', 'ok');
            expect(result).toHaveProperty('unknown', null);
        });
    });

    describe('getKeyView and getView', () => {
        it('returns null for a key that has never been injected', () => {
            const { behavior } = makeSetup();
            expect(behavior.getKeyView('nope')).toBeNull();
        });

        it('getView returns null when no keys have been injected', () => {
            const { behavior } = makeSetup();
            expect(behavior.getView()).toBeNull();
        });

        it('getView returns all tracked keys with their AsyncResult state', () => {
            const { behavior } = makeSetup();
            behavior.inject('a', new Promise(() => {}));
            const view = behavior.getView();
            expect(view).not.toBeNull();
            expect(view!['a']?.isPending()).toBe(true);
        });
    });
});
