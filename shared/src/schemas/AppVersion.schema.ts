import z from 'zod';

export const AppVersionSchema = z.object({
    config: z.number(),
    app: z.string(),
});
export type AppVersion = z.infer<typeof AppVersionSchema>;
