import { z } from 'zod';
import { RiotMatchPlayerScoresSchema } from '#/schemas/RiotMatchApiReponseDTO.ts';

export const IndicatorKind = z.enum(
    [
        "double_up",
        "up",
        "neutral",
        "down",
        "double_down",
    ]
)

export const ScoreEntry = z.object({
    indicator: IndicatorKind,
    value: z.number()
})

export const TierThresholds = z.object({
    average: z.number(),
    good: z.number(),
    excellent: z.number(),
});

export const GraphDefinition = z.object({
    average: z.number(),
    min: z.number(),
    max: z.number(),
    tierThresholds: TierThresholds,
})

export const FightStatsBlock = z.object({
    damage: ScoreEntry,
    kills_adj: ScoreEntry,
    deaths_adj: ScoreEntry,
    trades: ScoreEntry
})

export const SupportStatsBlock = z.object({
    assists: ScoreEntry,
    // defuses: ScoreEntry,
    plants: ScoreEntry,
    utilityUsage: ScoreEntry
})

export const NamedStatsBlock = z.object({
    totalScore: z.number(),
    fightStats: FightStatsBlock.optional().nullable(),
    supportStats: SupportStatsBlock.optional().nullable(),
    performanceGraph: GraphDefinition.optional().nullable()
})

export const NamedStatsBlockSchema = RiotMatchPlayerScoresSchema
    .transform((scores) => {
        const r = scores as any;
        const performanceGraph: z.infer<typeof GraphDefinition> = {
            average: r.TempValueT?.TempValueR,
            min: r.TempValueT?.TempValueV,
            max: r.TempValueT?.TempValueU,
            tierThresholds: {
                average: r.TempValueT?.TempValueS?.pass,
                good: r.TempValueT?.TempValueS?.merit,
                excellent: r.TempValueT?.TempValueS?.distinction,
            },
        }

        /**
         * Fields seemingly can be omitted from the object if they are not calculatable I guess ?
         * In example data if a user had 0 kills over the entire match their Kill impact was omitted from the map
         * For ease of use will we simply denote that as 0
         * */

        const fightStats: z.infer<typeof FightStatsBlock> = {
            damage: {
                value: r.TempValueA ?? 0,
                indicator: r.TempValueL?.TempValueP?.damage
            },
            kills_adj: {
                value: r.TempValueI ?? 0,
                indicator: r.TempValueL?.TempValueP?.killImpact
            },
            deaths_adj: {
                value: (-1.0) * (r.TempValueJ ?? 0),
                indicator: r.TempValueL?.TempValueP?.deathImpact
            },
            trades: {
                value: r.TempValueB ?? 0,
                indicator: r.TempValueL?.TempValueP?.trades
            }
        }

        const supportStats: z.infer<typeof SupportStatsBlock> = {
            assists: {
                value: r.TempValueC ?? 0,
                indicator: r.TempValueL?.TempValueQ?.assists
            },
            // defuses: {
            //     value: r.TempValueJ,
            //     indicator: r.TempValueL?.TempValueQ?.defuses
            // },
            plants: {
                value: r.TempValueE ?? 0,
                indicator: r.TempValueL?.TempValueQ?.plants
            },
            utilityUsage: {
                value: r.TempValueD ?? 0,
                indicator: r.TempValueL?.TempValueQ?.utilityUsage
            }
        }

        return {
            totalScore: r.TempValueF,
            performanceGraph: performanceGraph,
            fightStats: fightStats,
            supportStats: supportStats
        } as z.infer<typeof NamedStatsBlock>
    })
    .pipe(NamedStatsBlock);