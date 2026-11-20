import { z } from 'zod';

export const GUIDSchema = z.guid();

export type GUID = z.infer<typeof GUIDSchema>