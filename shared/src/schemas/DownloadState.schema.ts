import { z } from "zod";

export const MatchPartSchema = z.enum(['stats', 'replay']);

export type MatchPart = z.infer<typeof MatchPartSchema>;

export const MATCH_PARTS = MatchPartSchema.options;

export const PartDownloadState = {
    MISSING: "MISSING",
    DOWNLOADING: "DOWNLOADING",
    STORED: "STORED",
    FAILED: "FAILED",
} as const;

export const PartDownloadStateSchema = z.enum(PartDownloadState);

export type PartDownloadState = z.infer<typeof PartDownloadStateSchema>;

export const MatchPartStatesSchema = z.record(MatchPartSchema, PartDownloadStateSchema);

export type MatchPartStates = z.infer<typeof MatchPartStatesSchema>;

export const MatchPartsSchema = z.record(MatchPartSchema, z.boolean());

export type MatchParts = z.infer<typeof MatchPartsSchema>;

export const DownloadStateDTOSchema = z.object({
    parts: MatchPartStatesSchema,
});

export type DownloadStateDTO = z.infer<typeof DownloadStateDTOSchema>;
