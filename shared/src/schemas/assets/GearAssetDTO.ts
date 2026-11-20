import { z } from "zod";
import { ExternalURLSchema } from '../ExternalURL.schema';

export const GearAssetDetailSchema = z.object({
    name: z.string(),
    value: z.string(),
});

export type GearAssetDetail = z.infer<typeof GearAssetDetailSchema>;

export const GearShopDataSchema = z.object({
    cost: z.number(),
    category: z.string().nullable(),
    shopOrderPriority: z.number(),
    categoryText: z.string().nullable(),

    gridPosition: z.unknown().nullable(),

    canBeTrashed: z.boolean(),

    image: ExternalURLSchema.nullable(),
    newImage: ExternalURLSchema.nullable(),
    newImage2: ExternalURLSchema.nullable(),

    assetPath: z.string(),
});

export type GearShopData = z.infer<typeof GearShopDataSchema>;

export const GearAssetDTOSchema = z.object({
    uuid: z.string(),

    displayName: z.string(),
    description: z.string(),

    descriptions: z.array(z.string()),
    details: z.array(GearAssetDetailSchema),

    displayIcon: ExternalURLSchema,

    assetPath: z.string(),

    shopData: GearShopDataSchema.nullable(),
});

export type GearAssetDTO = z.infer<typeof GearAssetDTOSchema>;