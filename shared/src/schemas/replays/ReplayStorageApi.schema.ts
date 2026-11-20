import { z } from 'zod';
import { GUIDSchema } from '../GUIDSchema';
import { PaginationQuerySchema, PaginationResultSchema } from '../Pagination.schema';
import { ReplayMetadataV2Schema, UserMetadataSchema } from '../ReplayFormatV2.schema';
import { DownloadStateDTOSchema } from '../DownloadState.schema';

export const MatchIdParamSchema = z.object({
    matchId: GUIDSchema,
});

export const ReplayListQuerySchema = PaginationQuerySchema;

export const ReplayListResponseSchema = PaginationResultSchema(ReplayMetadataV2Schema);

export const ImportReplayQuerySchema = z.object({
    override: z.stringbool().default(false),
});

export const DownloadStatesResponseSchema = z.record(GUIDSchema, DownloadStateDTOSchema);

export const UserMetadataPatchSchema = UserMetadataSchema
    .partial()
    .strict()
    .refine((patch) => Object.keys(patch).length > 0, 'At least one field must be provided');

export type MatchIdParam = z.infer<typeof MatchIdParamSchema>;
export type ReplayListQuery = z.infer<typeof ReplayListQuerySchema>;
export type ReplayListResponse = z.infer<typeof ReplayListResponseSchema>;
export type ImportReplayQuery = z.infer<typeof ImportReplayQuerySchema>;
export type DownloadStatesResponse = z.infer<typeof DownloadStatesResponseSchema>;
export type UserMetadataPatch = z.infer<typeof UserMetadataPatchSchema>;
