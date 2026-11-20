import { z } from 'zod';
import { PlayerAliasSchema } from './PlayerAlias.schema';
import { RiotMatchApiResponseDTOSchema } from './RiotMatchApiReponseDTO';
import { GUIDSchema } from './GUIDSchema';

export const DownloaderMetadataSchema = z.object({
    downloadedAt: z.number(),
    downloaderId: GUIDSchema,
});

export const UserMetadataSchema = z.object({
    name: z.string().nonempty(),
    tags: z.array(z.string().max(48)),
    notes: z.string().optional().nullable(),
});

export const RiotMatchMetadataSchema = z.object({
    matchMetadata: RiotMatchApiResponseDTOSchema,

    puuidResolver: z
        .record(GUIDSchema, PlayerAliasSchema.nullish())
});

export const ReplayFileMetadataSchema = z.object({
    fileSizeBytes: z.number(),
    checksum: z.string().nonempty(),
});

export const ImportFlowIdSchema = z.enum([
    'MANUAL_DOWNLOAD',
    'AUTO_ARCHIVE',
    'INJECTION_PLACEHOLDER',
    'FILE_UPLOAD',
]);

export const ReplayMetadataV2Schema = z.object({
    formatVersion: z.number(),
    uuid: z.uuid(),
    importFlowId: ImportFlowIdSchema.optional().nullable(),
    downloaderMetadata: DownloaderMetadataSchema.optional().nullable(),
    riotMatchMetadata: RiotMatchMetadataSchema.optional().nullable(),
    replayFileMetadata: ReplayFileMetadataSchema.optional().nullable(),
    userMetadata: UserMetadataSchema.optional().nullable()
});

export const CURRENT_REPLAY_FORMAT_VERSION = 3;

export type ImportFlowId = z.infer<typeof ImportFlowIdSchema>;
export type DownloaderMetadata = z.infer<typeof DownloaderMetadataSchema>;
export type RiotMatchMetadata = z.infer<typeof RiotMatchMetadataSchema>;
export type ReplayFileMetadata = z.infer<typeof ReplayFileMetadataSchema>;
export type UserMetadata = z.infer<typeof UserMetadataSchema>;
export type ReplayMetadataV2 = z.infer<typeof ReplayMetadataV2Schema>;