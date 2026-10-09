import z from 'zod';
import { mapValues } from 'lodash';
import { RiotMatchApiResponseDTO } from '#/schemas/RiotMatchApiReponseDTO';

export const ReplaySummarySchema = z.object({
    GameVersion: z.string().nonempty(),
    Checksum: z.string().nonempty(),
});

export type ReplaySummary = z.infer<typeof ReplaySummarySchema>;

const AccoladeTempNameSchema = z.object({
    puuid: z.guid(),
    version: z.number().positive(),
    tempS: z.record(
        z.guid(),
        z.object({
            tempS: z.guid(),
            tempA: z.record(
                z.guid(),
                z.object({
                    id: z.guid(),
                    tempC: z.int(),
                    tempB: z.number(),
                }),
            ),
        }),
    ).optional(),
    tempM: z.array(
        z.object({
            id: z.guid(),
            tempG: z.number().positive(),
            tempP: z.record(
                z.guid(),
                z.object({
                    tempA: z.record(
                        z.guid(),
                        z.object({
                            id: z.guid(),
                            tempV: z.number(),
                            tempB: z.boolean(),
                        }),
                    ),
                }),
            ),
        }),
    ),
});

const AccoladeInfoSchema = z.object({
    puuid: z.guid(),
    version: z.number().positive(),
    seasonalData: z.record(
        z.guid(),
        z.object({
            acquiredAccolades: z.record(
                z.guid(),
                z.object({
                    timesAcquired: z.number(),
                    highestScore: z.number(),
                }),
            ),
        }),
    ).optional(),
    recentGameData: z.record(
        z.guid(),
        z.object({
            timestamp: z.number().positive(),
            playerData: z.record(
                z.guid(),
                z.object({
                    acquiredAccolades: z.record(
                        z.guid(),
                        z.object({
                            score: z.number(),
                            personalBest: z.boolean(),
                        }),
                    ),
                }),
            ),
        }),
    ).optional(),
});

export const AccoladeInfoFromRiotSchema = AccoladeTempNameSchema.transform((raw): z.infer<typeof AccoladeInfoSchema> => ({
    puuid: raw.puuid,
    version: raw.version,

    seasonalData: raw.tempS && mapValues(raw.tempS, (season) => ({
        acquiredAccolades: mapValues(season.tempA, (a) => ({
            timesAcquired: a.tempC,
            highestScore: a.tempB,
        })),
    })),

    recentGameData: raw.tempM && Object.fromEntries(
        raw.tempM.map((game) => [
            game.id,
            {
                timestamp: game.tempG,
                playerData: mapValues(game.tempP, (player) => ({
                    acquiredAccolades: mapValues(player.tempA, (a) => ({
                        score: a.tempV,
                        personalBest: a.tempB,
                    })),
                })),
            },
        ]),
    ),
})).pipe(AccoladeInfoSchema);

export type AccoladeInfo = z.infer<typeof AccoladeInfoFromRiotSchema>

const MatchHistoryEntrySchema = z.object({
    MatchID: z.guid(),
    GameStartTime: z.number(),
    QueueID: z.string(),
});

export type MatchHistoryEntry = z.infer<typeof MatchHistoryEntrySchema>

export const MatchHistoryResponseSchema = z.object({
    Subject: z.guid(),
    BeginIndex: z.number(),
    EndIndex: z.number(),
    Total: z.number(),
    History: z.array(MatchHistoryEntrySchema)
});

export type MatchHistoryResponse = z.infer<typeof MatchHistoryResponseSchema>

const DeploymentContextSchema = z.object({
    version: z.string(),
    puuid: z.guid(),
});

export type DeploymentContext = z.infer<typeof DeploymentContextSchema>

export const ConnectionStateSchema = z.object({
    subject: z.guid(),
    cxnState: z.string(),
    cxnCloseReason: z.string(),
    clientID: z.string(),
    clientVersion: z.string(),
    loopState: z.string(),
    loopStateMetadata: z.string(),
    version: z.number(),
    lastHeartbeatTime: z.iso.datetime(),
    playtimeNotification: z.string(),
    playtimeMinutes: z.number(),
    isRestricted: z.boolean(),
    restrictionType: z.string(),
    clientPlatformInfo: z.object({
        platformType: z.string(),
        platformOS: z.string(),
        platformOSVersion: z.string(),
        platformChipset: z.string(),
        platformDevice: z.string(),
    }),
    shouldForceInvalidate: z.boolean(),
});

export type ConnectionState = z.infer<typeof ConnectionStateSchema>

export interface MatchApiSpec {
    getHistory(startIndex?: number, endIndex?: number): Promise<MatchHistoryEntry[]>;

    getDetails(matchId: string): Promise<RiotMatchApiResponseDTO>;
}

export interface ReplayApiSpec {
    getSummary(matchId: string): Promise<ReplaySummary>;

    downloadFile(matchId: string): Promise<Buffer>;
}

export interface AccoladeApiSpec {
    getForPlayer(puuid: string): Promise<AccoladeInfo>;
}

export interface SessionApiSpec {
    getGameLoopState(): Promise<ConnectionState>;
}

export interface ValorantApiSpec {
    readonly matches: MatchApiSpec;
    readonly replays: ReplayApiSpec;
    readonly accolades: AccoladeApiSpec;
    readonly session: SessionApiSpec;
}