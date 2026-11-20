import { z } from "zod";

export const ExternalURLSchema = z.string();

export type ExternalURL = z.infer<typeof ExternalURLSchema>;