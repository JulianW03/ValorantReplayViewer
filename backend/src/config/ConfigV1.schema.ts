import { z } from 'zod';
import semver, { SemVer } from 'semver';
import path from 'path';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SupportedRegionSchema = z.enum(['na', 'latam', 'eu', 'ap', 'kr', 'br']);
export type SupportedRegion = z.infer<typeof SupportedRegionSchema>;

export const SupportedShardSchema = z.enum(['na', 'pbe', 'eu', 'ap', 'kr']);
export type SupportedShard = z.infer<typeof SupportedShardSchema>;

export const LogLevelSchema = z.enum(['log', 'error', 'warn', 'debug', 'verbose'])
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const RegionToDefaultShardMap: Record<SupportedRegion, SupportedShard> = {
    na: SupportedShardSchema.enum.na,
    latam: SupportedShardSchema.enum.na,
    br: SupportedShardSchema.enum.na,
    eu: SupportedShardSchema.enum.eu,
    ap: SupportedShardSchema.enum.ap,
    kr: SupportedShardSchema.enum.kr
} as const;

// ---------------------------------------------------------------------------
// VersionConfig
// ---------------------------------------------------------------------------

export const VersionConfig = z.object({
    config: z.number(),
    app: z.string().refine((v) => semver.valid(v) !== null, {
        message: 'app must be a valid semver string',
    }),
});
export type VersionConfig = z.infer<typeof VersionConfig>;

export function getSemver(version: VersionConfig): SemVer {
    return new SemVer(version.app);
}

// ---------------------------------------------------------------------------
// FilepathEntry / FilepathConfig
// ---------------------------------------------------------------------------

export const FilepathEntry = z.object({
    relativeToEnvVar: z.string().optional(),
    path: z.array(z.string()),
});
export type FilepathEntry = z.infer<typeof FilepathEntry>;

export function getResolvedPath(entry: FilepathEntry): string {
    if (entry.relativeToEnvVar) {
        const envValue = process.env[entry.relativeToEnvVar];
        if (!envValue) {
            throw new Error(`Environment variable ${entry.relativeToEnvVar} is not set`);
        }
        return path.join(envValue, ...entry.path);
    }
    return path.join(...entry.path);
}

export const FilepathConfig = z.object({
    'riot-games-folder': FilepathEntry,
    'valorant-saved': FilepathEntry,
});
export type FilepathConfig = z.infer<typeof FilepathConfig>;

// ---------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------

export const VersionReadConfiguration = z.object({
    'retry-timeout-ms': z.number().int().positive().default(5_000),
    regex: z.string(),
});
export type VersionReadConfiguration = z.infer<typeof VersionReadConfiguration>;

export const LoggingConfigurationSchema = z.object({
    levels: z.array(LogLevelSchema),
    'file-levels': z.array(LogLevelSchema).optional(),
    'max-log-files': z.number().int().positive().default(10),
});
export type LoggingConfiguration = z.infer<typeof LoggingConfigurationSchema>;

export const AppConfigurationConfig = z.object({
    port: z.number().int().positive().default(3_000),
    logging: LoggingConfigurationSchema,
    'additional-cors-origins': z.array(z.string()).default([]),
});
export type AppConfigurationConfig = z.infer<typeof AppConfigurationConfig>;

export const Configurations = z.object({
    app: AppConfigurationConfig,
    'valorant-version-read': VersionReadConfiguration,
});
export type Configurations = z.infer<typeof Configurations>;

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

export const ValorantVersionReadOverrides = z.object({
    version: z.string().optional(),
});
export type ValorantVersionReadOverrides = z.infer<typeof ValorantVersionReadOverrides>;

export const ValorantApiOverrides = z.object({
    region: SupportedRegionSchema.optional(),
    shard: SupportedShardSchema.optional(),
});
export type ValorantApiOverrides = z.infer<typeof ValorantApiOverrides>;

export const OverrideConfig = z.object({
    'valorant-api': ValorantApiOverrides,
    'valorant-version-read': ValorantVersionReadOverrides,
});
export type OverrideConfig = z.infer<typeof OverrideConfig>;

// ---------------------------------------------------------------------------
// Root DTO
// ---------------------------------------------------------------------------

export const EnvConfigV1DTOSchema = z.object({
    version: VersionConfig,
    filepaths: FilepathConfig,
    configurations: Configurations,
    overrides: OverrideConfig,
});

export type EnvConfigV1DTO = z.infer<typeof EnvConfigV1DTOSchema>;

export const OverridableConfigV1Schema = z
    .object({
        filepaths: FilepathConfig.partial().strict().optional(),
        configurations: z
            .object({
                app: AppConfigurationConfig.partial().strict().optional(),
                'valorant-version-read': VersionReadConfiguration.partial().strict().optional(),
            })
            .strict()
            .optional(),
        overrides: z
            .object({
                'valorant-api': ValorantApiOverrides.strict().optional(),
                'valorant-version-read': ValorantVersionReadOverrides.strict().optional(),
            })
            .strict()
            .optional(),
    })
    .strict();

export type OverridableConfigV1 = z.infer<typeof OverridableConfigV1Schema>;
