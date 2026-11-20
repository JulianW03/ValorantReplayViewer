import { z } from 'zod';
import { GUIDSchema } from './GUIDSchema';

export const TWO_TEAM_ROLE_IDS = {
    ATTACKER: 'Attacker',
    DEFENDER: 'Defender',
} as const;

export const TwoTeamRoleIdSchema = z.enum([
    TWO_TEAM_ROLE_IDS.ATTACKER,
    TWO_TEAM_ROLE_IDS.DEFENDER,
]);

export type TWO_TEAMS_ROLE_ID = z.infer<typeof TwoTeamRoleIdSchema>;

export const TWO_TEAM_IDS = {
    RED: 'Red',
    BLUE: 'Blue',
} as const;

export const TwoTeamIdSchema = z.enum([
    TWO_TEAM_IDS.RED,
    TWO_TEAM_IDS.BLUE,
]);

export type TWO_TEAMS_TEAM_ID = z.infer<typeof TwoTeamIdSchema>;

export const getOppositeTeamId = (teamId: TWO_TEAMS_TEAM_ID) =>
    teamId === TWO_TEAM_IDS.RED ? TWO_TEAM_IDS.BLUE : TWO_TEAM_IDS.RED;

export const AbilityCastsSchema = z.object({
    grenadeCasts: z.number(),
    ability1Casts: z.number(),
    ability2Casts: z.number(),
    ultimateCasts: z.number(),
});

export type AbilityCasts = z.infer<typeof AbilityCastsSchema>;

/**
 * We could also explicitly type this, but currently in the JSON the vars are called 'TempValue[A-Z]' so I think
 * (and hope) that the entries will have better names in the future
 */
export const RiotMatchPlayerScoresSchema = z.record(z.string(), z.unknown());

export type RiotMatchPlayerScores = z.infer<typeof RiotMatchPlayerScoresSchema>;

export const RiotMatchPlayerStatsSchema = z.object({
    score: z.number(),
    roundsPlayed: z.number(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    playtimeMillis: z.number(),
    abilityCasts: AbilityCastsSchema.optional().nullable(),
    platformInfo: z.unknown().optional().nullable(),
});

export type RiotMatchPlayerStats = z.infer<typeof RiotMatchPlayerStatsSchema>;

export const RiotMatchPlayerSchema = z.object({
    subject: GUIDSchema,
    gameName: z.string(),
    tagLine: z.string(),
    teamId: z.string(),
    partyId: z.uuid().optional().nullable(),
    characterId: z.string(),
    isObserver: z.boolean(),
    stats: RiotMatchPlayerStatsSchema,
    scores: RiotMatchPlayerScoresSchema.optional().nullable()
});

export type RiotMatchPlayer = z.infer<typeof RiotMatchPlayerSchema>;

export const RiotMatchTeamSchema = z.object({
    teamId: z.string(),
    won: z.boolean(),
    roundsPlayed: z.number(),
    roundsWon: z.number(),
    numPoints: z.number(),
});

export type RiotMatchTeam = z.infer<typeof RiotMatchTeamSchema>;

export const RiotMatchInfoSchema = z.object({
    matchId: z.string(),
    mapId: z.string(),
    gamePodId: z.string().optional().nullable(),
    gameLoopZone: z.string().optional().nullable(),
    gameVersion: z.string(),
    gameLengthMillis: z.number(),
    gameStartMillis: z.number(),
    provisioningFlowID: z.string().optional().nullable(),
    queueID: z.string(),
    gameMode: z.string(),
    isRanked: z.boolean(),
    isMatchSampled: z.boolean().optional(),
    platformType: z.string(),
    seasonId: GUIDSchema.optional().nullable(),
    premierMatchInfo: z.any().optional().nullable(),
    partyRRPenalties: z.record(GUIDSchema, z.number()).optional().nullable(),
    shouldMatchDisablePenalties: z.boolean().optional().nullable(),
    newMapLossReductionModifier: z.number().optional().nullable(),
    isReplayRecorded: z.boolean(),
});

export type RiotMatchInfo = z.infer<typeof RiotMatchInfoSchema>;

export const LocationSchema = z.object({
    x: z.number(),
    y: z.number(),
});

export type Location = z.infer<typeof LocationSchema>;

export const KillSchema = z.object({
    gameTime: z.number(),
    roundTime: z.number(),
    killer: GUIDSchema,
    victim: GUIDSchema,
    victimLocation: LocationSchema,
    assistants: z.array(GUIDSchema),
    playerLocations: z.array(
        z.object({
            subject: GUIDSchema,
            viewRadians: z.number(),
            location: LocationSchema,
        }),
    ),
    finishingDamage: z.object({
        damageType: z.string(),
        damageItem: z.string().optional().nullable(),
        isSecondaryFireMode: z.boolean().optional().nullable(),
    })
});

// Finishing Damage can be ['Ability', 'Bomb', 'Melee', 'Fall', 'Weapon'] as of now.

export type Kill = z.infer<typeof KillSchema>;

export const RoundAnnotatedKillSchema = KillSchema.extend({
    round: z.number(),
});

export const EconomySchema = z.object({
    loadoutValue: z.number(),
    weapon: z.union([GUIDSchema, z.literal('')]),
    armor: z.union([GUIDSchema, z.literal('')]),
    remaining: z.number(),
    spent: z.number(),
});

export type Economy = z.infer<typeof EconomySchema>;

export const RoundResultSchema = z.object({
    roundNum: z.number(),
    roundResult: z.string(),
    roundCeremony: z.string(),
    ceremonyPlayer: z.uuid().optional().nullable(),
    ceremonyTeam: z.string().optional().nullable(),
    winningTeam: z.union([TwoTeamIdSchema, z.string()]),
    winningTeamRole: z.union([TwoTeamRoleIdSchema, z.string()]),
    firstBloodPlayer: z.uuid().optional().nullable(),
    bombPlanter: GUIDSchema.optional().nullable(),
    bombDefuser: GUIDSchema.optional().nullable(),
    plantRoundTime: z.number().optional(),
    plantPlayerLocations: z
        .array(
            z.object({
                subject: GUIDSchema,
                viewRadians: z.number(),
                location: LocationSchema,
            }),
        )
        .optional().nullable(),
    plantLocation: LocationSchema.optional(),
    plantSite: z.string().optional(),
    defuseRoundTime: z.number().optional(),
    defusePlayerLocations: z
        .array(
            z.object({
                subject: GUIDSchema,
                viewRadians: z.number(),
                location: LocationSchema,
            }),
        )
        .optional().nullable(),
    defuseLocation: LocationSchema.optional(),
    playerStats: z.array(
        z.object({
            subject: GUIDSchema,
            score: z.number(),
            kills: z.array(KillSchema),
            damage: z.array(
                z.object({
                    receiver: GUIDSchema,
                    damage: z.number(),
                    legshots: z.number(),
                    bodyshots: z.number(),
                    headshots: z.number(),
                }),
            ),
            wasAfk: z.boolean(),
            wasPenalized: z.boolean(),
            stayedInSpawn: z.boolean(),
            economy: EconomySchema,
        }),
    ),

    playerEconomies: z.array(
        EconomySchema.extend({
            subject: GUIDSchema,
        }),
    ).optional().nullable(),

    playerScores: z.array(
        z.object({
            subject: GUIDSchema,
            score: z.number(),
        }),
    ).optional().nullable(),
});

export type RoundResult = z.infer<typeof RoundResultSchema>;

export const RiotMatchApiResponseDTOSchema = z.object({
    matchInfo: RiotMatchInfoSchema,
    players: z.array(RiotMatchPlayerSchema),
    bots: z.array(z.any()).optional().nullable(),
    coaches: z.array(z.any()).optional().nullable(),
    teams: z.array(RiotMatchTeamSchema).optional().nullable(),
    roundResults: z.array(RoundResultSchema),
    kills: z.array(RoundAnnotatedKillSchema).nullable(),
});

export type RiotMatchApiResponseDTO = z.infer<
    typeof RiotMatchApiResponseDTOSchema
>;