import { z } from 'zod';

export const PaginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginationResultSchema = <T extends z.ZodType>(item: T) => z.object({
    data: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
});

export interface PaginationResult<T> {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
