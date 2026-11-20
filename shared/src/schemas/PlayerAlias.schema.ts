import { z } from 'zod';

export const PlayerAliasSchema = z.object({
    tagLine: z.string(),
    gameName: z.string(),
});


export type PlayerAliasDTO = z.infer<typeof PlayerAliasSchema>;
