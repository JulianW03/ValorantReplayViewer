import { z } from 'zod';

export const InjectState = {
    IDLE: 'IDLE',
    DOWNLOADING_PLACEHOLDER: 'DOWNLOADING_PLACEHOLDER',
    AWAITING_REPLAY_START: 'AWAITING_REPLAY_START',
    INJECTED: 'INJECTED',
    RESTORING_ORIGINAL_REPLAY: 'RESTORING_ORIGINAL_REPLAY',
    FAILED: 'FAILED',
} as const;

export const InjectStateSchema = z.enum(InjectState);

export type InjectState = z.infer<typeof InjectStateSchema>;

export const InjectStatusSchema = z.object({
    state: InjectStateSchema,
    targetMatchId: z.string().nullable(),
    placeholderMatchId: z.string().nullable(),
});

export type InjectStatus = z.infer<typeof InjectStatusSchema>;
