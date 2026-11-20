export const AsyncResultType = {
    PENDING: "PENDING",
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE",
} as const;

export type AsyncResultType =
    (typeof AsyncResultType)[keyof typeof AsyncResultType];

export abstract class AsyncResult<T, E extends Error> {
    abstract readonly type: AsyncResultType;

    static pending<T, E extends Error = Error>(): Pending<T, E> {
        return new Pending<T, E>();
    }

    static success<T, E extends Error = Error>(
        value: T,
    ): Success<T, E> {
        return new Success<T, E>(value);
    }

    static failure<T, E extends Error = Error>(
        error: E,
    ): Failure<T, E> {
        return new Failure<T, E>(error);
    }

    static async fromPromise<T>(
        promise: Promise<T>,
    ): Promise<AsyncResult<T, Error>> {
        try {
            return AsyncResult.success<T, Error>(await promise);
        } catch (e: unknown) {
            const error =
                e instanceof Error
                    ? e
                    : new Error(String(e));

            return AsyncResult.failure<T, Error>(error);
        }
    }

    static async fromPromiseWithErrorMapper<
        T,
        E extends Error,
    >(
        promise: Promise<T>,
        mapError: (error: unknown) => E,
    ): Promise<AsyncResult<T, E>> {
        try {
            return AsyncResult.success<T, E>(await promise);
        } catch (e: unknown) {
            return AsyncResult.failure<T, E>(mapError(e));
        }
    }

    static async fromPromiseWithGuaranteedErrorType<T, E extends Error>(
        promise: Promise<T>,
    ): Promise<AsyncResult<T, E>> {
        try {
            return AsyncResult.success<T, E>(await promise);
        } catch (e: unknown) {
            return AsyncResult.failure<T, E>(e as E);
        }
    }

    isPending(): this is Pending<T, E> {
        return this instanceof Pending;
    }

    isSuccess(): this is Success<T, E> {
        return this instanceof Success;
    }

    isFailure(): this is Failure<T, E> {
        return this instanceof Failure;
    }

    abstract map<U>(fn: (value: T) => U): AsyncResult<U, E>;

    abstract flatMap<U>(
        fn: (value: T) => AsyncResult<U, E>,
    ): AsyncResult<U, E>;

    abstract flatMapAsync<U>(
        fn: (value: T) => Promise<AsyncResult<U, E>>,
    ): Promise<AsyncResult<U, E>>;

    abstract mapError<F extends Error>(
        fn: (error: E) => F,
    ): AsyncResult<T, F>;

    abstract unwrapOr(defaultValue: T): T;

    abstract match<R>(
        success: (value: T) => R,
        failure: (error: E) => R,
        pending: () => R,
    ): R;

    abstract toPromise(): Promise<T>;
}

export class Pending<T, E extends Error>
    extends AsyncResult<T, E> {
    readonly type = AsyncResultType.PENDING;

    map<U>(): AsyncResult<U, E> {
        return new Pending<U, E>();
    }

    flatMap<U>(): AsyncResult<U, E> {
        return new Pending<U, E>();
    }

    async flatMapAsync<U>(): Promise<AsyncResult<U, E>> {
        return new Pending<U, E>();
    }

    mapError<F extends Error>(): AsyncResult<T, F> {
        return new Pending<T, F>();
    }

    unwrapOr(defaultValue: T): T {
        return defaultValue;
    }

    match<R>(
        _: (value: T) => R,
        __: (error: E) => R,
        pending: () => R,
    ): R {
        return pending();
    }

    toPromise(): Promise<T> {
        return Promise.reject(
            new Error("Cannot convert Pending to Promise"),
        );
    }
}

export class Success<T, E extends Error>
    extends AsyncResult<T, E> {
    readonly type = AsyncResultType.SUCCESS;
    readonly data: T;

    constructor(data: T) {
        super();
        this.data = data;
    }

    map<U>(fn: (value: T) => U): AsyncResult<U, E> {
        return new Success<U, E>(fn(this.data));
    }

    flatMap<U>(
        fn: (value: T) => AsyncResult<U, E>,
    ): AsyncResult<U, E> {
        return fn(this.data);
    }

    flatMapAsync<U>(
        fn: (value: T) => Promise<AsyncResult<U, E>>,
    ): Promise<AsyncResult<U, E>> {
        return fn(this.data);
    }

    mapError<F extends Error>(
        _fn: (error: E) => F,
    ): AsyncResult<T, F> {
        return new Success<T, F>(this.data);
    }

    unwrapOr(_defaultValue: T): T {
        return this.data;
    }

    match<R>(
        success: (value: T) => R,
        _failure: (error: E) => R,
        _pending: () => R,
    ): R {
        return success(this.data);
    }

    toPromise(): Promise<T> {
        return Promise.resolve(this.data);
    }
}

export class Failure<T, E extends Error>
    extends AsyncResult<T, E> {
    readonly type = AsyncResultType.FAILURE;
    readonly error: E;

    constructor(error: E) {
        super();
        this.error = error;
    }

    map<U>(): AsyncResult<U, E> {
        return new Failure<U, E>(this.error);
    }

    flatMap<U>(): AsyncResult<U, E> {
        return new Failure<U, E>(this.error);
    }

    async flatMapAsync<U>(): Promise<AsyncResult<U, E>> {
        return new Failure<U, E>(this.error);
    }

    mapError<F extends Error>(
        fn: (error: E) => F,
    ): AsyncResult<T, F> {
        return new Failure<T, F>(fn(this.error));
    }

    unwrapOr(defaultValue: T): T {
        return defaultValue;
    }

    match<R>(
        _success: (value: T) => R,
        failure: (error: E) => R,
        _pending: () => R,
    ): R {
        return failure(this.error);
    }

    toPromise(): Promise<T> {
        return Promise.reject(this.error);
    }
}