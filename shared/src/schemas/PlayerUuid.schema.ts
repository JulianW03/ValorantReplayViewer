import { z } from 'zod';

export const PlayerUUIDSchema = z.object({
    uuid: z.uuid(),
});

export type PlayerUuidDTO = z.infer<typeof PlayerUUIDSchema>;