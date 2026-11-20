import { z } from 'zod';
import { ExternalURLSchema } from '../ExternalURL.schema';

export const MapAssetDTOSchema = z.object({
    uuid: z.string(),

    displayName: z.string(),

    narrativeDescription: z.string().nullable(),
    coordinates: z.string().nullable(),

    displayIcon: ExternalURLSchema.nullable(),
    listViewIcon: ExternalURLSchema.nullable(),
    listViewIconTall: ExternalURLSchema.nullable(),
    splash: ExternalURLSchema.nullable(),
    stylizedBackgroundImage: ExternalURLSchema.nullable(),
    premierBackgroundImage: ExternalURLSchema.nullable(),

    assetPath: z.string(),
    mapUrl: z.string(),
});

export type MapAssetDTO = z.infer<typeof MapAssetDTOSchema>;