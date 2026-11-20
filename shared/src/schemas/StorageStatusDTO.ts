import { z } from "zod";

export const StorageStatusDTOSchema = z.object({
    isSetup: z.boolean(),
    matchCount: z.number().int(),
    totalSizeBytes: z.number().int(),
});

export type StorageStatusDTO = z.infer<typeof StorageStatusDTOSchema>;
