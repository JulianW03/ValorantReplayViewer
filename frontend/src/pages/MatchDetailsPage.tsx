import { type JSX, useState } from 'react';
import { groupBy, groupByUnique } from '@/lib/utils.ts';
import { RoundOverviewTab } from '@/components/match-details/RoundOverviewTab.tsx';
import { VersusTab } from '@/components/advancedDetails/VersusTab.tsx';
import { useMatchMetadata } from '@/lib/queries.ts';
import { type Params, useParams } from 'react-router-dom';
import {
    MatchOverviewHeader,
    type MatchOverviewHeaderProps,
} from '@/components/advancedDetails/MatchOverviewHeader.tsx';
import { type RiotMatchTeam, TWO_TEAM_IDS, type TWO_TEAMS_TEAM_ID } from '@vrv/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';

const TABS = {
    ROUND_OVERVIEW: 'RoundOverview',
    VERSUS: 'Versus',
} as const;

type Tab = typeof TABS[keyof typeof TABS];

const OVERVIEW_TAB_LABELS: Record<Tab, string> = {
    [TABS.ROUND_OVERVIEW]: 'ROUND OVERVIEW',
    [TABS.VERSUS]: 'VERSUS',
};

const OverviewTypeSelector = (
    {
        tab,
        onSelectTab,
    }: {
        tab: Tab;
        onSelectTab: (tab: Tab) => void;
    },
) => {
    const tabs = Object.values(TABS);

    return (
        <div className={'flex gap-0.5 py-4 px-2'}>
            {tabs.map((value, index) => {
                const isActive = tab === value;
                const isFirst = index === 0;
                const isLast = index === tabs.length - 1;
                const clipPath = isFirst
                    ? 'polygon(0 0, 100% 0, 94% 100%, 0% 100%)'
                    : isLast
                        ? 'polygon(6% 0, 100% 0, 100% 100%, 0% 100%)'
                        : 'polygon(6% 0, 100% 0, 94% 100%, 0% 100%)';

                return (
                    <div
                        key={value}
                        role={'button'}
                        tabIndex={0}
                        onClick={() => onSelectTab(value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                onSelectTab(value);
                            }
                        }}
                        style={{
                            flex: '1 1 0%',
                            position: 'relative',
                            clipPath,
                            background: isActive
                                ? `linear-gradient(${isLast ? '270deg' : '90deg'}, rgba(255, 70, 85, 0.16), rgba(255, 70, 85, 0.04))`
                                : 'rgba(255, 255, 255, 0.02)',
                            padding: isLast ? '9px 22px 9px 0px' : `9px 0px 9px ${isFirst ? 14 : 22}px`,
                            textAlign: isLast ? 'right' : 'left',
                            cursor: 'pointer',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '11.5px',
                                fontWeight: isActive ? 700 : 600,
                                letterSpacing: '0.06em',
                                color: isActive ? 'rgb(232, 232, 234)' : 'rgba(255, 255, 255, 0.35)',
                            }}
                        >
                            {OVERVIEW_TAB_LABELS[value]}
                        </span>
                        {isActive && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: isLast ? undefined : 0,
                                    right: isLast ? 0 : undefined,
                                    width: '60%',
                                    height: '2px',
                                    background: `linear-gradient(${isLast ? '270deg' : '90deg'}, rgb(255, 70, 85), rgba(255, 70, 85, 0.15))`,
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const TeamPerspectiveSelector = (
    {
        teams,
        selectedTeam,
        onSelectTeam,
    }: {
        teams: Record<TWO_TEAMS_TEAM_ID, RiotMatchTeam>;
        selectedTeam: TWO_TEAMS_TEAM_ID;
        onSelectTeam: (teamId: TWO_TEAMS_TEAM_ID) => void;
    },
) => {
    return (
        <div className={'flex items-center gap-2 px-6 pb-3 text-sm'}>
            <span className={'text-muted-foreground'}>Viewing as</span>
            <Select value={selectedTeam} onValueChange={(value) => onSelectTeam(value as TWO_TEAMS_TEAM_ID)}>
                <SelectTrigger size={'sm'} className={'w-36'}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {Object.keys(teams).map((teamId) => (
                        <SelectItem key={teamId} value={teamId}>
                            {teamId} Team
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

const MatchDetailsPage = (): JSX.Element => {
    const { matchId } = useParams<Params>();
    const { data, isLoading, isError } = useMatchMetadata(matchId || '');
    const [tab, setTab] = useState<Tab>(TABS.ROUND_OVERVIEW);
    const [selectedTeam, setSelectedTeam] = useState<TWO_TEAMS_TEAM_ID>(TWO_TEAM_IDS.RED);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (isError || data === undefined) {
        return <div>Error loading match data.</div>;
    }

    if (!data.riotMatchMetadata) {
        return <div>No metadata for match ${matchId}</div>;
    }

    const hasHighlightPlayer = !!data.downloaderMetadata;

    const highlightPlayer = data.downloaderMetadata?.downloaderId;

    const highlightPlayerTeam: TWO_TEAMS_TEAM_ID | undefined = hasHighlightPlayer
        ? data.riotMatchMetadata.matchMetadata.players.find(p => p.subject === highlightPlayer)?.teamId as TWO_TEAMS_TEAM_ID | undefined
        : selectedTeam;
    const winningTeam = data.riotMatchMetadata?.matchMetadata?.teams?.find(it => it.won);
    const teamsById = groupByUnique((t => t.teamId), ...data.riotMatchMetadata?.matchMetadata?.teams ?? []) as Record<TWO_TEAMS_TEAM_ID, RiotMatchTeam>;
    const matchOverviewHeaderData: MatchOverviewHeaderProps = {
        teams: teamsById,
        mapId: data.riotMatchMetadata.matchMetadata.matchInfo.mapId,
        winningTeam: winningTeam?.teamId as TWO_TEAMS_TEAM_ID | undefined,
        userTeam: highlightPlayerTeam,
        startTimeMillis: data.riotMatchMetadata.matchMetadata.matchInfo.gameStartMillis,
        queueId: data.riotMatchMetadata.matchMetadata.matchInfo.queueID,
        durationMillis: data.riotMatchMetadata.matchMetadata.matchInfo.gameLengthMillis,
    };

    if (data.formatVersion === 1) {
        return <div>Replay Version 1 doesnt support this view :(</div>;
    }

    const activePlayersByTeam = groupBy((p => p.teamId), ...data.riotMatchMetadata.matchMetadata.players.filter(p => !p.isObserver)!);

    if (Object.keys(activePlayersByTeam).length !== 2) {
        return <div>Not supported...</div>;
    }

    switch (tab) {
        case TABS.ROUND_OVERVIEW:
            return (
                <>
                    <MatchOverviewHeader data={matchOverviewHeaderData} />
                    {!hasHighlightPlayer && (
                        <TeamPerspectiveSelector
                            teams={teamsById}
                            selectedTeam={selectedTeam}
                            onSelectTeam={setSelectedTeam}
                        />
                    )}
                    <OverviewTypeSelector tab={tab} onSelectTab={setTab} />
                    <RoundOverviewTab data={data} highlightPlayerUuid={highlightPlayer}
                                      highlightPlayerTeam={highlightPlayerTeam} /></>
            );
        case TABS.VERSUS:
            return <>
                <MatchOverviewHeader data={matchOverviewHeaderData} />
                {!hasHighlightPlayer && (
                    <TeamPerspectiveSelector
                        teams={teamsById}
                        selectedTeam={selectedTeam}
                        onSelectTeam={setSelectedTeam}
                    />
                )}
                <OverviewTypeSelector tab={tab} onSelectTab={setTab} />
                <VersusTab data={data} />
            </>;
    }

};

export default MatchDetailsPage;
