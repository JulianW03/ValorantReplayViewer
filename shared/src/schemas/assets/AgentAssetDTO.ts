import { z } from 'zod';
import { ExternalURLSchema } from '../ExternalURL.schema';

export const AgentAssetDTOSchema = z.object({
    displayName: z.string(),
    description: z.string().nullable(),
    developerName: z.string(),
    releaseDate: z.string(),

    uuid: z.string(),

    characterTags: z.array(z.string()).nullable(),

    displayIcon: ExternalURLSchema.nullable(),
    displayIconSmall: ExternalURLSchema.nullable(),
    bustPortrait: ExternalURLSchema.nullable(),
    fullPortrait: ExternalURLSchema.nullable(),
    fullPortraitV2: ExternalURLSchema.nullable(),
    killfeedPortrait: ExternalURLSchema.nullable(),
    minimapPortrait: ExternalURLSchema.nullable().optional(),
    homeScreenPromoTileImage: ExternalURLSchema.nullable(),

    background: ExternalURLSchema.nullable(),
    backgroundGradientColors: z.array(z.string()).nullable(),

    assetPath: z.string(),

    isFullPortraitRightFacing: z.boolean(),
    isPlayableCharacter: z.boolean(),
    isAvailableForTest: z.boolean(),
    isBaseContent: z.boolean(),
});

export type AgentAssetDTO = z.infer<typeof AgentAssetDTOSchema>;