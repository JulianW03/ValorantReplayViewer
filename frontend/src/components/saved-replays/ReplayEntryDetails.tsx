import {
    MatchDetailsPanel,
    type MinimalMatchInfo,
    type MinimalMatchPlayer,
    type MinimalMatchTeam,
} from '@/components/match-details/MatchDetailsPanel.tsx';
import type { GUID, ReplayMetadataV2, RiotMatchMetadata } from '@vrv/shared';

interface ReplayEntryDetailsProps {
    replay: ReplayMetadataV2;
    highlightPlayer?: GUID;
}

function buildPanelProps(apiData: RiotMatchMetadata) {
    const matchInfo: MinimalMatchInfo = {
        matchId: apiData.matchMetadata.matchInfo.matchId,
        mapId: apiData.matchMetadata.matchInfo.mapId,
        queueID: apiData.matchMetadata.matchInfo.queueID,
        gameVersion: apiData.matchMetadata.matchInfo.gameVersion,
        gameLengthMillis: apiData.matchMetadata.matchInfo.gameLengthMillis,
        gameStartMillis: apiData.matchMetadata.matchInfo.gameStartMillis,
        isRanked: apiData.matchMetadata.matchInfo.isRanked,
    };

    // teams comes back nullable from the Riot DTO (bot/coach-only matches, etc.)
    const teams: MinimalMatchTeam[] = (apiData.matchMetadata.teams ?? []).map((team) => ({
        teamId: team.teamId,
        won: team.won,
        roundsPlayed: team.roundsPlayed,
        roundsWon: team.roundsWon,
    }));

    const players: MinimalMatchPlayer[] = apiData.matchMetadata.players.map((player) => ({
        subject: player.subject,
        gameName: apiData.puuidResolver[player.subject]?.gameName,
        tagLine: apiData.puuidResolver[player.subject]?.tagLine,
        teamId: player.teamId,
        characterId: player.characterId,
        isObserver: player.isObserver,
        stats: {
            kills: player.stats.kills,
            deaths: player.stats.deaths,
            assists: player.stats.assists,
        },
    }));

    return { matchInfo, teams, players };
}

export function ReplayEntryDetails({ replay, highlightPlayer }: ReplayEntryDetailsProps) {
    const apiData = replay.riotMatchMetadata;

    if (!apiData) {
        return (
            <div className="px-4 pb-4 text-xs text-muted-foreground italic">
                No match data available for this replay
                {replay.userMetadata?.notes ? (
                    <p className="mt-2 not-italic text-foreground">{replay.userMetadata.notes}</p>
                ) : null}
            </div>
        );
    }

    const { matchInfo, teams, players } = buildPanelProps(apiData);

    return (
        <MatchDetailsPanel
            teams={teams}
            players={players}
            matchInfo={matchInfo}
            highlightPlayer={highlightPlayer}
        />
    );
}
