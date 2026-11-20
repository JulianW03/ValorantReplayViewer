import { z } from 'zod';
import { MatchPartsSchema } from '../DownloadState.schema';

export const QueueSelectionTypeSchema = z.enum(['ALL', 'SELECTED_ONLY', 'NON_SELECTED', 'NONE']);

export const QueueIdSchema = z.string().trim().toLowerCase().max(64);

/** Riot reports custom games with an empty queue ID. */
export const CUSTOM_GAME_QUEUE_ID = '';

export const QueueIdSetSchema = z.array(QueueIdSchema)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, 'Queue IDs must be unique');

export const QueueSelectionSchema = z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal(QueueSelectionTypeSchema.enum.ALL) }),
    z.strictObject({
        type: z.literal(QueueSelectionTypeSchema.enum.SELECTED_ONLY),
        includedQueueIds: QueueIdSetSchema,
    }),
    z.strictObject({
        type: z.literal(QueueSelectionTypeSchema.enum.NON_SELECTED),
        excludedQueueIds: QueueIdSetSchema,
    }),
    z.strictObject({ type: z.literal(QueueSelectionTypeSchema.enum.NONE) }),
]);

export const AutoArchiveSettingsSchema = z.strictObject({
    stats: QueueSelectionSchema,
    replays: QueueSelectionSchema,
});

export const DEFAULT_AUTO_ARCHIVE_SETTINGS: AutoArchiveSettings = {
    stats: { type: QueueSelectionTypeSchema.enum.NONE },
    replays: { type: QueueSelectionTypeSchema.enum.NONE },
};

export const AutoArchiveProgressStateSchema = z.enum(['SAVING', 'SAVED', 'FAILED']);

export const AutoArchiveProgressSchema = z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal(AutoArchiveProgressStateSchema.enum.SAVING) }),
    z.strictObject({ state: z.literal(AutoArchiveProgressStateSchema.enum.SAVED), stored: MatchPartsSchema }),
    z.strictObject({ state: z.literal(AutoArchiveProgressStateSchema.enum.FAILED), stored: MatchPartsSchema }),
]);

export type AutoArchiveProgress = z.infer<typeof AutoArchiveProgressSchema>;
export type QueueSelectionType = z.infer<typeof QueueSelectionTypeSchema>;
export type QueueSelection = z.infer<typeof QueueSelectionSchema>;
export type AutoArchiveSettings = z.infer<typeof AutoArchiveSettingsSchema>;
