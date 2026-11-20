import { z } from 'zod';

const KNOWN_PRODUCTS = {
    VALORANT: 'valorant',
    LEAGUE_OF_LEGENDS: 'league_of_legends',
    LEGENDS_OF_RUNETERRA: 'bacon',
    TFT: 'teamfighttactics',
    '2XKO': 'lion',
    RIOT_CLIENT: 'riot_client',
} as const;

const MatchPresenceSchema = z.object({
    matchMap: z.string().nullish(),
    provisioningFlow: z.string().nullish(),
    queueId: z.string().nullish(),
    sessionLoopState: z.string().nullish(),
});

const PartyPresenceSchema = z.object({
    customGameName: z.string().nullish(),
    customGameTeam: z.string().nullish(),
    isPartyCrossPlayEnabled: z.boolean().nullish(),
    isPartyOwner: z.boolean().nullish(),
    isPlayerCrossPlayEnabled: z.boolean().nullish(),
    maxPartySize: z.number().nullish(),
    partyId: z.string().nullish(),
    partyLFM: z.boolean().nullish(),
    partyAccessibility: z.string().nullish(),
    partyClientVersion: z.string().nullish(),
    partyOwnerMatchMap: z.string().nullish(),
    partyOwnerMatchScoreAllyTeam: z.number().nullish(),
    partyOwnerMatchScoreEnemyTeam: z.number().nullish(),
    partyOwnerProvisioningFlow: z.string().nullish(),
    partyOwnerSessionLoopState: z.string().nullish(),
    partyPrecisePlatformTypes: z.number().nullish(),
    partySize: z.number().nullish(),
    partyState: z.string().nullish(),
    partyVersion: z.number().nullish(),
    queueEntryTime: z.string().nullish(),
    rosterId: z.string().nullish(),
    tournamentId: z.string().nullish(),
});

const PlayerPresenceSchema = z.object({
    accountLevel: z.number().nullish(),
    competitiveTier: z.number().nullish(),
    leaderboardPosition: z.number().nullish(),
    platformOverride: z.string().nullish(),
    playerCardId: z.string().nullish(),
    playerTitleId: z.string().nullish(),
});

const PremierPresenceSchema = z.object({
    division: z.number().nullish(),
    plating: z.number().nullish(),
    rosterId: z.string().nullish(),
    rosterName: z.string().nullish(),
    rosterTag: z.string().nullish(),
    rosterType: z.string().nullish(),
    score: z.number().nullish(),
    showAura: z.boolean().nullish(),
    showPlating: z.boolean().nullish(),
    showTag: z.boolean().nullish(),
});

const ProductDataSchema = z.object({
    isIdle: z.boolean().nullish(),
    isValid: z.boolean().nullish(),
    matchPresenceData: MatchPresenceSchema.nullish(),
    maxPartySize: z.number().nullish(),
    partyId: z.string().nullish(),
    partyOwnerMatchScoreAllyTeam: z.number().nullish(),
    partyOwnerMatchScoreEnemyTeam: z.number().nullish(),
    partyPresenceData: PartyPresenceSchema.nullish(),
    partySize: z.number().nullish(),
    playerPresenceData: PlayerPresenceSchema.nullish(),
    premierPresenceData: PremierPresenceSchema.nullish(),
    provisioningFlow: z.string().nullish(),
    queueId: z.string().nullish(),
});

export const Social_Presence = {
    KNOWN_PRODUCTS,
    Valorant: {
        MatchPresenceSchema,
        PartyPresenceSchema,
        PlayerPresenceSchema,
        PremierPresenceSchema,
        ProductDataSchema,
    },
} as const;

export type MatchPresence = z.infer<typeof MatchPresenceSchema>;
export type PartyPresence = z.infer<typeof PartyPresenceSchema>;
export type PlayerPresence = z.infer<typeof PlayerPresenceSchema>;
export type PremierPresence = z.infer<typeof PremierPresenceSchema>;
export type ProductData = z.infer<typeof ProductDataSchema>;

export const SocialPresenceSchema = z.object({
    product: z.string(),
    region: z.string().nullable(),
    productData: z.any().optional(),
}).transform((val) => {
    if (val.product !== KNOWN_PRODUCTS.VALORANT) {
        return val;
    }
    return {
        ...val,
        productData: ProductDataSchema.nullish().parse(val.productData),
    };
})

export type SocialPresence = z.infer<typeof SocialPresenceSchema>
