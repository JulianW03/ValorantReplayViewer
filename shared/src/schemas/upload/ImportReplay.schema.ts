import { z } from "zod";
import { UserMetadataSchema } from '../ReplayFormatV2.schema';

export const ReplayFileTypeSchema = z.enum([
    "package",
    "riotMetadata",
    "replayFile",
]);

const BaseImportSchema = z.object({
    userMetadata: UserMetadataSchema.optional().nullable()
});

export const ReplayImportSchema = z.discriminatedUnion("type", [
    BaseImportSchema.extend({
        type: z.literal(ReplayFileTypeSchema.enum.package),
    }),
    BaseImportSchema.extend({
        type: z.literal(ReplayFileTypeSchema.enum.riotMetadata),
    }),
    BaseImportSchema.extend({
        type: z.literal(ReplayFileTypeSchema.enum.replayFile),
    }),
]);

export type ReplayFileType = z.infer<typeof ReplayFileTypeSchema>;
export type ReplayImportRequest = z.infer<typeof ReplayImportSchema>;