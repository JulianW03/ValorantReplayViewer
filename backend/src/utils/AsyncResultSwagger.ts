import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { InternalServerErrorException } from '@nestjs/common';
import { AsyncResult, AsyncResultType, Failure, Pending, Success } from '@vrv/shared';

// Apply decorators without modifying the core classes
ApiProperty({
    enum: AsyncResultType,
    enumName: 'AsyncResultType',
    default: AsyncResultType.PENDING,
})(Pending.prototype, 'type');
ApiProperty({
    enum: AsyncResultType,
    enumName: 'AsyncResultType',
    default: AsyncResultType.SUCCESS,
})(Success.prototype, 'type');
ApiProperty({type: Object})(Success.prototype, 'data');
ApiProperty({
    enum: AsyncResultType,
    enumName: 'AsyncResultType',
    default: AsyncResultType.FAILURE,
})(Failure.prototype, 'type');
ApiProperty({type: Object})(Failure.prototype, 'error');

type ErrorConstructor<E extends Error> = new (...args: any[]) => E;

export async function mapErrorAsync<T, E extends Error>(
    asyncResultPromise: Promise<AsyncResult<T, E>>,
    errorMap: Map<ErrorConstructor<any>, (e: any) => Error>,
): Promise<T> {
    let res: AsyncResult<T, E>;
    try {
        res = await asyncResultPromise;
    } catch (err) {
        throw new InternalServerErrorException(err);
    }

    if (res.isSuccess()) return res.data;

    if (res.isFailure()) {
        for (const [ErrorCtor, mapper] of errorMap.entries()) {
            if (res.error instanceof ErrorCtor) throw mapper(res.error);
        }

        throw new InternalServerErrorException('Unhandled error type', { cause: res.error });
    }

    throw new InternalServerErrorException('Unexpected pending state');
}

export const AsyncResultSchema = (payloadRef: string) => {
    return {
        oneOf: [
            { $ref: getSchemaPath(Pending) },
            {
                allOf: [
                    { $ref: getSchemaPath(Success) },
                    {
                        type: 'object',
                        properties: { data: { $ref: payloadRef } },
                    },
                ],
            },
            {
                allOf: [
                    { $ref: getSchemaPath(Failure) },
                    {
                        type: 'object',
                        properties: {
                            error: {
                                type: 'object',
                                properties: { message: { type: 'string' } },
                                required: ['message'],
                            },
                        },
                    },
                ],
            },
        ],
        discriminator: {
            propertyName: 'type',
            mapping: {
                [AsyncResultType.PENDING]: getSchemaPath(Pending),
                [AsyncResultType.SUCCESS]: getSchemaPath(Success),
                [AsyncResultType.FAILURE]: getSchemaPath(Failure),
            },
        },
    };
};

export { AsyncResult, AsyncResultType, Pending, Success, Failure } from '@vrv/shared';