import { z } from "zod";
import { ExternalURLSchema } from '../ExternalURL.schema';


export const WeaponADSStatsSchema = z.object({
    zoomMultiplier: z.number(),
    fireRate: z.number(),
    runSpeedMultiplier: z.number(),
    burstCount: z.number(),
    firstBulletAccuracy: z.number(),
});

export type WeaponADSStats = z.infer<typeof WeaponADSStatsSchema>;

export const WeaponStatsSchema = z.object({
    fireRate: z.number(),
    magazineSize: z.number(),
    runSpeedMultiplier: z.number(),
    equipTimeSeconds: z.number(),
    firstBulletAccuracy: z.number(),

    wallPenetration: z.string(),

    feature: z.string().nullable(),
    fireMode: z.string().nullable(),
    altFireType: z.string().nullable(),

    adsStats: WeaponADSStatsSchema.nullable(),

    altShotgunStats: z.unknown().nullable(),
    airBurstStats: z.unknown().nullable(),
});

export type WeaponStats = z.infer<typeof WeaponStatsSchema>;

export const WeaponAssetDTOSchema = z.object({
    uuid: z.string(),

    displayName: z.string(),
    category: z.string(),

    defaultSkinUuid: z.string(),

    displayIcon: ExternalURLSchema,
    killStreamIcon: ExternalURLSchema,

    weaponStats: WeaponStatsSchema.nullable(),

    shopData: z.unknown(),
    skins: z.array(z.unknown()),
});

export type WeaponAssetDTO = z.infer<typeof WeaponAssetDTOSchema>;