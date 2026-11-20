import z from 'zod';

export const UnknownStatusReason = z.enum({
    NO_FETCH_YET: 'NO_FETCH_YET',
    REMOTE_FETCH_FAILED: 'REMOTE_FETCH_FAILED',
    REMOTE_SCHEMA_INVALID: 'REMOTE_SCHEMA_INVALID',
    VERSION_PARSE_FAILED: 'VERSION_PARSE_FAILED',
})

export const UpdateInfoSchema = z.object({
    version: z.string(),
    release_notes: z.string().optional(),
    download_url: z.url(),
});
export type UpdateInfo = z.infer<typeof UpdateInfoSchema>;

export const UpdateStatusIndicator = z.enum({
    UNKNOWN: 'UNKNOWN',
    UP_TO_DATE: 'UP_TO_DATE',
    UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
});

export const UpdateStatusBaseSchema = z.object({
    last_check_timestamp: z.iso.datetime(),
    repo_url: z.url(),
});

export const UpdateStatusSchema = z.discriminatedUnion('status', [
    UpdateStatusBaseSchema.extend({
        status: z.literal(UpdateStatusIndicator.enum.UP_TO_DATE),
    }),
    UpdateStatusBaseSchema.extend({
        status: z.literal(UpdateStatusIndicator.enum.UNKNOWN),
        reason: UnknownStatusReason,
        // No check has happened yet in the NO_FETCH_YET case
        last_check_timestamp: z.iso.datetime().nullable(),
    }),
    UpdateStatusBaseSchema.extend({
        status: z.literal(UpdateStatusIndicator.enum.UPDATE_AVAILABLE),
        update_info: UpdateInfoSchema,
    }),
]);
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;