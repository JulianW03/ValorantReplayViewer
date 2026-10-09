import {
    TWO_TEAM_IDS,
    type RiotMatchApiResponseDTO,
    type RiotMatchPlayer,
    type TWO_TEAMS_TEAM_ID,
} from '#/schemas/RiotMatchApiReponseDTO.ts';
import type { GUID } from '#/schemas/GUIDSchema.ts';
import type { RiotMatchMetadata } from '#/schemas/ReplayFormatV2.schema.ts';
import { NamedStatsBlock, NamedStatsBlockSchema } from '@/lib/ScoringUtils.ts';
import z from 'zod'

type Match = RiotMatchApiResponseDTO;
export type RoundResult = Match['roundResults'][number];
export type AnnotatedKill = NonNullable<Match['kills']>[number];

export interface ShotBreakdown {
    head: number;
    body: number;
    leg: number;
}

export const shotTotal = (s: ShotBreakdown): number => s.head + s.body + s.leg;
export const headshotRate = (s: ShotBreakdown): number => (shotTotal(s) === 0 ? 0 : s.head / shotTotal(s));

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export interface MatchIndex {
    match: Match;
    metadata: RiotMatchMetadata;
    playersById: Map<GUID, RiotMatchPlayer>;
    killsByRound: Map<number, AnnotatedKill[]>;
    roundsByNum: Map<number, RoundResult>;
    /** Active (non-observer) players keyed by team, ordered Red then Blue. */
    playersByTeam: Array<{ teamId: TWO_TEAMS_TEAM_ID; players: RiotMatchPlayer[] }>;
}

export function buildMatchIndex(metadata: RiotMatchMetadata): MatchIndex {
    const match = metadata.matchMetadata;

    const playersById = new Map<GUID, RiotMatchPlayer>();
    for (const player of match.players) playersById.set(player.subject, player);

    const killsByRound = new Map<number, AnnotatedKill[]>();
    for (const kill of match.kills ?? []) {
        const bucket = killsByRound.get(kill.round);
        if (bucket) bucket.push(kill);
        else killsByRound.set(kill.round, [kill]);
    }
    for (const bucket of killsByRound.values()) bucket.sort((a, b) => a.roundTime - b.roundTime);

    const roundsByNum = new Map<number, RoundResult>();
    for (const round of match.roundResults ?? []) roundsByNum.set(round.roundNum, round);

    const active = match.players.filter((p) => !p.isObserver);
    const playersByTeam = Object.values(TWO_TEAM_IDS)
        .map((teamId) => ({
            teamId,
            players: active.filter((p) => p.teamId === teamId),
        }))
        .filter((team) => team.players.length > 0);

    return { match, metadata, playersById, killsByRound, roundsByNum, playersByTeam };
}

export const topFragger = (players: RiotMatchPlayer[]): RiotMatchPlayer | undefined =>
    players.reduce<RiotMatchPlayer | undefined>(
        (best, player) => (best === undefined || player.stats.kills > best.stats.kills ? player : best),
        undefined,
    );

export const displayName = (index: MatchIndex, subject: GUID): { gameName: string; tagLine: string } => {
    const resolved = index.metadata.puuidResolver?.[subject];
    const player = index.playersById.get(subject);
    return {
        gameName: resolved?.gameName ?? player?.gameName ?? 'Unknown',
        tagLine: resolved?.tagLine ?? player?.tagLine ?? '',
    };
};

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

export interface VersusPlayerStats {
    subject: GUID;
    teamId: TWO_TEAMS_TEAM_ID;
    gameName: string;
    tagLine: string;
    agentId: string;
    roundsPlayed: number;

    kills: number;
    deaths: number;
    assists: number;
    kda: number;

    firstBloods: number;
    firstDeaths: number;

    plants: number;
    defuses: number;

    damageDealt: number;
    damageTaken: number;
    adr: number;
    shots: ShotBreakdown;
    headshotPct: number;

    combatScore: number;
    acs: number;

    doubleKills: number;
    tripleKills: number;
    quadKills: number;
    aces: number;

    survivalRate: number;
    avgLoadoutValue: number;
    avgSpend: number;
    ultimateCasts: number;

    performance: z.infer<typeof NamedStatsBlock> | null
}

export function buildPlayerStats(index: MatchIndex, subject: GUID): VersusPlayerStats {
    const player = index.playersById.get(subject)!;
    const rounds = index.match.roundResults ?? [];
    const roundsPlayed = Math.max(player.stats.roundsPlayed, 1);

    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let firstBloods = 0;
    let firstDeaths = 0;
    const killsPerRound = new Map<number, number>();

    for (const [roundNum, roundKills] of index.killsByRound) {
        roundKills.forEach((kill, position) => {
            if (kill.killer === subject) {
                kills += 1;
                killsPerRound.set(roundNum, (killsPerRound.get(roundNum) ?? 0) + 1);
                if (position === 0) firstBloods += 1;
            }
            if (kill.victim === subject) {
                deaths += 1;
                if (position === 0) firstDeaths += 1;
            }
            if (kill.killer !== subject && kill.assistants?.includes(subject)) assists += 1;
        });
    }

    let damageDealt = 0;
    let damageTaken = 0;
    let combatScore = 0;
    let loadoutTotal = 0;
    let spendTotal = 0;
    let economyRounds = 0;
    let plants = 0;
    let defuses = 0;
    const shots: ShotBreakdown = { head: 0, body: 0, leg: 0 };

    for (const round of rounds) {
        if (round.bombPlanter === subject) plants += 1;
        if (round.bombDefuser === subject) defuses += 1;

        for (const stat of round.playerStats) {
            if (stat.subject === subject) {
                combatScore += stat.score;
                loadoutTotal += stat.economy.loadoutValue;
                spendTotal += stat.economy.spent;
                economyRounds += 1;
                for (const dmg of stat.damage) {
                    damageDealt += dmg.damage;
                    shots.head += dmg.headshots;
                    shots.body += dmg.bodyshots;
                    shots.leg += dmg.legshots;
                }
            } else {
                for (const dmg of stat.damage) {
                    if (dmg.receiver === subject) damageTaken += dmg.damage;
                }
            }
        }
    }

    const multiKills = [...killsPerRound.values()];
    const name = displayName(index, subject);

    const optStatsBlock = NamedStatsBlockSchema.safeParse(player.scores);
    const statsBlock = optStatsBlock.success ? optStatsBlock.data : null;

    console.log(player.scores)
    console.log(optStatsBlock.error)

    return {
        subject,
        teamId: player.teamId as TWO_TEAMS_TEAM_ID,
        gameName: name.gameName,
        tagLine: name.tagLine,
        agentId: player.characterId,
        roundsPlayed: player.stats.roundsPlayed,

        kills,
        deaths,
        assists,
        kda: deaths === 0 ? kills + assists : (kills + assists) / deaths,

        firstBloods,
        firstDeaths,

        plants,
        defuses,

        damageDealt,
        damageTaken,
        adr: damageDealt / roundsPlayed,
        shots,
        headshotPct: headshotRate(shots) * 100,

        combatScore,
        acs: combatScore / roundsPlayed,

        doubleKills: multiKills.filter((n) => n === 2).length,
        tripleKills: multiKills.filter((n) => n === 3).length,
        quadKills: multiKills.filter((n) => n === 4).length,
        aces: multiKills.filter((n) => n >= 5).length,

        survivalRate: (1 - deaths / roundsPlayed) * 100,
        avgLoadoutValue: economyRounds === 0 ? 0 : loadoutTotal / economyRounds,
        avgSpend: economyRounds === 0 ? 0 : spendTotal / economyRounds,
        ultimateCasts: player.stats.abilityCasts?.ultimateCasts ?? 0,
        performance: statsBlock
    };
}

// ---------------------------------------------------------------------------
// Duels
// ---------------------------------------------------------------------------

export type DuelKind = 'direct' | 'assisted';

export interface DuelEvent {
    round: number;
    roundTimeMs: number;
    kind: DuelKind;
    /** Which of the two selected players came out on top. */
    winner: GUID;
    loser: GUID;
    /** The player who actually landed the kill — differs from `winner` on assisted duels. */
    killer: GUID;
    damageType: string;
    weaponId?: string | null;
}

export interface HeadToHeadDamage {
    damage: number;
    shots: ShotBreakdown;
}

export interface DuelSide {
    subject: GUID;
    direct: number;
    assisted: number;
    total: number;
    damage: HeadToHeadDamage;
}

export interface DuelSummary {
    events: DuelEvent[];
    a: DuelSide;
    b: DuelSide;
    roundsContested: number;
    /** Rounds won by A's team among rounds where the two met. */
    contestedRoundsWonByA: number;
}

const emptySide = (subject: GUID): DuelSide => ({
    subject,
    direct: 0,
    assisted: 0,
    total: 0,
    damage: { damage: 0, shots: { head: 0, body: 0, leg: 0 } },
});

export function buildDuelSummary(index: MatchIndex, aId: GUID, bId: GUID): DuelSummary {
    const events: DuelEvent[] = [];
    const a = emptySide(aId);
    const b = emptySide(bId);
    const teamOf = (id: GUID) => index.playersById.get(id)?.teamId;
    const aTeam = teamOf(aId);

    const contestedRounds = new Set<number>();
    let contestedRoundsWonByA = 0;

    for (const [roundNum, roundKills] of index.killsByRound) {
        const round = index.roundsByNum.get(roundNum);

        for (const kill of roundKills) {
            let winner: GUID;
            let loser: GUID;
            let kind: DuelKind;

            if (kill.killer === aId && kill.victim === bId) {
                [winner, loser, kind] = [aId, bId, 'direct'];
            } else if (kill.killer === bId && kill.victim === aId) {
                [winner, loser, kind] = [bId, aId, 'direct'];
            } else if (kill.victim === bId && kill.assistants?.includes(aId)) {
                [winner, loser, kind] = [aId, bId, 'assisted'];
            } else if (kill.victim === aId && kill.assistants?.includes(bId)) {
                [winner, loser, kind] = [bId, aId, 'assisted'];
            } else {
                continue;
            }

            events.push({
                round: roundNum,
                roundTimeMs: kill.roundTime,
                kind,
                winner,
                loser,
                killer: kill.killer,
                damageType: kill.finishingDamage?.damageType ?? 'Unknown',
                weaponId: kill.finishingDamage?.damageItem,
            });

            const side = winner === aId ? a : b;
            side.total += 1;
            if (kind === 'direct') side.direct += 1;
            else side.assisted += 1;

            if (!contestedRounds.has(roundNum)) {
                contestedRounds.add(roundNum);
                if (round?.winningTeam === aTeam) contestedRoundsWonByA += 1;
            }
        }
    }

    for (const round of index.match.roundResults ?? []) {
        for (const stat of round.playerStats) {
            const side = stat.subject === aId ? a : stat.subject === bId ? b : undefined;
            if (!side) continue;
            const target = stat.subject === aId ? bId : aId;
            for (const dmg of stat.damage) {
                if (dmg.receiver !== target) continue;
                side.damage.damage += dmg.damage;
                side.damage.shots.head += dmg.headshots;
                side.damage.shots.body += dmg.bodyshots;
                side.damage.shots.leg += dmg.legshots;
            }
        }
    }

    events.sort((x, y) => x.round - y.round || x.roundTimeMs - y.roundTimeMs);

    return {
        events,
        a,
        b,
        roundsContested: contestedRounds.size,
        contestedRoundsWonByA,
    };
}

export const formatRoundTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};