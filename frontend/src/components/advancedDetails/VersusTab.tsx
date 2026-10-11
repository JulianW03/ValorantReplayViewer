import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils.ts';
import SlantedDisplay, { FacingDirections } from '@/components/advancedDetails/SlantedDisplay.tsx';
import AgentDisplayComponent from '@/components/advancedDetails/AgentDisplayComponent.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.tsx';
import { type RiotMatchPlayer, TWO_TEAM_IDS, type TWO_TEAMS_TEAM_ID } from '#/schemas/RiotMatchApiReponseDTO.ts';
import type { GUID } from '#/schemas/GUIDSchema.ts';
import type { ReplayMetadataV2 } from '#/schemas/ReplayFormatV2.schema.ts';
import {
    buildDuelSummary,
    buildMatchIndex,
    buildPlayerStats,
    displayName,
    type DuelEvent,
    formatRoundTime,
    type MatchIndex,
    topFragger,
    type VersusPlayerStats,
} from '@/lib/versusStats.ts';
import { useWeaponRegistry } from '@/lib/queries.ts';

const TEAM_STYLES: Record<TWO_TEAMS_TEAM_ID, { text: string; glow: string }> = {
    [TWO_TEAM_IDS.RED]: {
        text: 'text-rose-500 dark:text-rose-400',
        // drop-shadow follows the alpha channel, so the glow traces the slanted edge.
        glow: 'drop-shadow-[0_0_12px_rgba(244,63,94,0.7)]',
    },
    [TWO_TEAM_IDS.BLUE]: {
        text: 'text-sky-500 dark:text-sky-400',
        glow: 'drop-shadow-[0_0_12px_rgba(56,189,248,0.7)]',
    },
};

const number0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const number2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

const PlayerPick = ({

                        label,
                        selected,
                        children,
                    }: {
    teamId: TWO_TEAMS_TEAM_ID;
    label: string;
    selected: boolean;
    children: React.ReactNode;
}) => (
    <button
        type={'button'}
        aria-pressed={selected}
        aria-label={`Compare ${label}`}
        className={cn(
            'h-full w-full cursor-pointer transition duration-200 motion-reduce:transition-none',
            // ring-inset, because the parent's clipPath would cut off an outset ring.
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            selected
                ? cn('opacity-100')
                : 'opacity-40 grayscale hover:opacity-80 hover:grayscale-0',
        )}
    >
        {children}
    </button>
);

const TeamStrip = ({
                       index,
                       teamId,
                       players,
                       tilt,
                       gap,
                       tiltTowards,
                       selectedId,
                       onSelect,
                   }: {
    index: MatchIndex;
    teamId: TWO_TEAMS_TEAM_ID;
    players: RiotMatchPlayer[];
    tilt: number;
    gap: number;
    tiltTowards: typeof FacingDirections[keyof typeof FacingDirections];
    selectedId: GUID | undefined;
    onSelect: (subject: GUID) => void;
}) => (
    <SlantedDisplay
        tilt={tilt}
        gap={gap}
        tiltTowards={tiltTowards}
        items={players}
        // Controlled: selectedId is the single source of truth, so the widened item and
        // the highlight can't drift apart. Without this, SlantedDisplay's internalIndex
        // starts at 0 while selectedId starts at the top fragger.
        activeIndex={Math.max(0, players.findIndex((p) => p.subject === selectedId))}
        onActiveIndexChange={(next) => {
            const player = players[next];
            if (player) onSelect(player.subject);
        }}
        renderItem={(teamEntry, props) => {
            const name = displayName(index, teamEntry.subject);
            return (
                <PlayerPick
                    teamId={teamId}
                    label={`${name.gameName}#${name.tagLine}`}
                    selected={props.isSelected}
                >
                    <AgentDisplayComponent
                        agentId={teamEntry.characterId}
                        gameName={name.gameName}
                        tagLine={name.tagLine}
                        {...props}
                    />
                </PlayerPick>
            );
        }}
    />
);

// ---------------------------------------------------------------------------
// Shared row
// ---------------------------------------------------------------------------

interface StatRowProps {
    label: string;
    left: number | undefined;
    right: number | undefined;
    format?: (value: number) => React.ReactNode;
    leftTeam: TWO_TEAMS_TEAM_ID;
    rightTeam: TWO_TEAMS_TEAM_ID;
    lowerIsBetter?: boolean;
}

const StatRow = ({
                     label,
                     left,
                     right,
                     format = (value) => value,
                     leftTeam,
                     rightTeam,
                     lowerIsBetter = false,
                 }: StatRowProps) => {
    const comparable = left !== undefined && right !== undefined;
    const leftLeads = comparable && (lowerIsBetter ? left < right : left > right);
    const rightLeads = comparable && (lowerIsBetter ? right < left : right > left);
    const display = (value: number | undefined) => (value === undefined ? '–' : format(value));

    return (
        <div className={'grid grid-cols-3 items-center gap-3 py-1.5'}>
            <span
                className={cn(
                    'text-right text-sm tabular-nums',
                    leftLeads ? cn('font-semibold', TEAM_STYLES[leftTeam].text) : 'text-muted-foreground',
                )}
            >
                {display(left)}
            </span>
            <span className={'text-center text-xs text-muted-foreground'}>{label}</span>
            <span
                className={cn(
                    'text-sm tabular-nums',
                    rightLeads ? cn('font-semibold', TEAM_STYLES[rightTeam].text) : 'text-muted-foreground',
                )}
            >
                {display(right)}
            </span>
        </div>
    );
};

const NameRow = ({ left, right }: { left: VersusPlayerStats; right: VersusPlayerStats }) => (
    <div className={'grid grid-cols-3 items-center gap-3 pb-1'}>
        <span className={cn('truncate text-right text-sm font-semibold', TEAM_STYLES[left.teamId].text)}>
            {left.gameName}
        </span>
        <span />
        <span className={cn('truncate text-left text-sm font-semibold', TEAM_STYLES[right.teamId].text)}>
            {right.gameName}
        </span>
    </div>
);

const DuelRow = ({
                     event,
                     left,
                     right,
                 }: {
    event: DuelEvent;
    left: VersusPlayerStats;
    right: VersusPlayerStats;
}) => {
    const winner = event.winner === left.subject ? left : right;
    const weapon = useWeaponRegistry()?.[event.weaponId?.toLowerCase() ?? ''];

    return (
        <TableRow>
            <TableCell className={'tabular-nums text-muted-foreground'}>{event.round + 1}</TableCell>
            <TableCell className={'tabular-nums text-muted-foreground'}>{formatRoundTime(event.roundTimeMs)}</TableCell>
            <TableCell className={cn('font-medium', TEAM_STYLES[winner.teamId].text)}>{winner.gameName}</TableCell>
            <TableCell>
                <Badge variant={event.kind === 'direct' ? 'default' : 'secondary'}>
                    {event.kind === 'direct' ? 'Direct' : 'Assist'}
                </Badge>
            </TableCell>
            <TableCell className={'text-muted-foreground'}>
                {weapon?.displayName || event.damageType}
            </TableCell>
        </TableRow>
    );
};

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export interface VersusTabProps {
    data: ReplayMetadataV2;
    highlightPlayerUuid?: GUID;
    weaponName?: (weaponId: string) => string;
}

export function VersusTab({ data }: VersusTabProps) {
    const index = useMemo(() => buildMatchIndex(data.riotMatchMetadata!), [data]);
    const [leftTeam, rightTeam] = index.playersByTeam;

    const seed = (team: typeof leftTeam): GUID | undefined =>
        team?.players.find((p) => p.subject === data.downloaderMetadata?.downloaderId)?.subject ?? topFragger(team?.players ?? [])?.subject;

    const [leftId, setLeftId] = useState<GUID | undefined>(() => seed(leftTeam));
    const [rightId, setRightId] = useState<GUID | undefined>(() => seed(rightTeam));
    const [showAssists, setShowAssists] = useState(false);

    const left = useMemo(() => (leftId ? buildPlayerStats(index, leftId) : undefined), [index, leftId]);
    const right = useMemo(() => (rightId ? buildPlayerStats(index, rightId) : undefined), [index, rightId]);
    const duels = useMemo(
        () => (leftId && rightId ? buildDuelSummary(index, leftId, rightId) : undefined),
        [index, leftId, rightId],
    );
    const visibleEvents = useMemo(
        () => (showAssists ? duels?.events ?? [] : duels?.events.filter((event) => event.kind === 'direct') ?? []),
        [duels, showAssists],
    );

    if (!leftTeam || !rightTeam) {
        return <div className={'p-6 text-sm text-muted-foreground'}>This match doesn't have two teams to compare.</div>;
    }

    return (
        <div className={'space-y-4'}>
            <div className={'flex aspect-[6] w-full overflow-hidden sm:aspect-[10]'}>
                <div className={'flex-1 w-full'}>
                    <TeamStrip
                        index={index}
                        teamId={leftTeam.teamId}
                        players={leftTeam.players}
                        tilt={35}
                        gap={5}
                        tiltTowards={FacingDirections.LEFT}
                        selectedId={leftId}
                        onSelect={setLeftId}
                    />
                </div>
                <div
                    className={'flex w-8 items-center justify-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground'}>
                    vs
                </div>
                <div className={'flex-1 w-full'}>
                    <TeamStrip
                        index={index}
                        teamId={rightTeam.teamId}
                        players={rightTeam.players}
                        tilt={50}
                        gap={10}
                        tiltTowards={FacingDirections.RIGHT}
                        selectedId={rightId}
                        onSelect={setRightId}
                    />
                </div>
            </div>

            {left && right && duels && (
                <div className={'space-y-4 px-3 pb-3'}>
                    <Card>
                        <CardHeader>
                            <CardTitle className={'text-base'}>Duels</CardTitle>
                        </CardHeader>
                        <CardContent className={'space-y-4'}>
                            <div className={'text-center'}>
                                <div className={'text-xs uppercase tracking-wide text-muted-foreground'}>Kills on each
                                    other
                                </div>
                                <div className={'mt-1 grid grid-cols-3 items-baseline gap-3'}>
                                    <span
                                        className={cn('text-right text-4xl font-bold tabular-nums', TEAM_STYLES[left.teamId].text)}>
                                        {duels.a.direct}
                                    </span>
                                    <span className={'text-center text-lg text-muted-foreground'}>–</span>
                                    <span
                                        className={cn('text-left text-4xl font-bold tabular-nums', TEAM_STYLES[right.teamId].text)}>
                                        {duels.b.direct}
                                    </span>
                                </div>
                                <NameRow left={left} right={right} />
                            </div>

                            <div>
                                <StatRow label={'Assisted kills'} left={duels.a.assisted} right={duels.b.assisted}
                                         leftTeam={left.teamId} rightTeam={right.teamId} />
                                <StatRow label={'Damage dealt'} left={duels.a.damage.damage}
                                         right={duels.b.damage.damage} format={number0}
                                         leftTeam={left.teamId} rightTeam={right.teamId} />
                            </div>

                            <div className={'flex items-center justify-end gap-2'}>
                                <Checkbox
                                    id={'show-assists'}
                                    checked={showAssists}
                                    onCheckedChange={(checked) => setShowAssists(checked === true)}
                                />
                                <label htmlFor={'show-assists'} className={'text-xs text-muted-foreground'}>
                                    Show assists
                                </label>
                            </div>

                            {visibleEvents.length === 0 ? (
                                <p className={'py-4 text-center text-sm text-muted-foreground'}>
                                    {duels.events.length === 0
                                        ? 'These two never crossed paths. Pick another pairing to see their fights.'
                                        : 'No direct kills between them yet — enable "Show assists" to see assisted kills.'}
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Round</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Winner</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Weapon</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleEvents.map((event, i) => (
                                            <DuelRow
                                                key={`${event.round}-${event.roundTimeMs}-${i}`}
                                                event={event}
                                                left={left}
                                                right={right}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className={'text-base'}>Stats</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <NameRow left={left} right={right} />
                            <Accordion type={'multiple'} defaultValue={['kills', 'combat']}>
                                <AccordionItem value={'kills'}>
                                    <AccordionTrigger className={'text-sm'}>Kills</AccordionTrigger>
                                    <AccordionContent>
                                        <StatRow label={'Kills'} left={left.kills} right={right.kills}
                                                 leftTeam={left.teamId} rightTeam={right.teamId} />
                                        <StatRow label={'Deaths'} left={left.deaths} right={right.deaths}
                                                 leftTeam={left.teamId} rightTeam={right.teamId} lowerIsBetter />
                                        <StatRow label={'Assists'} left={left.assists} right={right.assists}
                                                 leftTeam={left.teamId} rightTeam={right.teamId} />
                                        <StatRow
                                            label={'KDA'}
                                            left={left.kda}
                                            right={right.kda}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow label={'First bloods'} left={left.firstBloods}
                                                 right={right.firstBloods} leftTeam={left.teamId}
                                                 rightTeam={right.teamId} />
                                        <StatRow label={'First deaths'} left={left.firstDeaths}
                                                 right={right.firstDeaths} leftTeam={left.teamId}
                                                 rightTeam={right.teamId} lowerIsBetter />
                                        <StatRow
                                            label={'Multikills 3+'}
                                            left={left.tripleKills + left.quadKills + left.aces}
                                            right={right.tripleKills + right.quadKills + right.aces}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value={'combat'}>
                                    <AccordionTrigger className={'text-sm'}>Combat</AccordionTrigger>
                                    <AccordionContent>
                                        <StatRow
                                            label={'Combat score'}
                                            left={left.acs}
                                            right={right.acs}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow
                                            label={'Damage / round'}
                                            left={left.adr}
                                            right={right.adr}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow
                                            label={'Headshot %'}
                                            left={left.headshotPct}
                                            right={right.headshotPct}
                                            format={percent}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow
                                            label={'Survived'}
                                            left={left.survivalRate}
                                            right={right.survivalRate}
                                            format={percent}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow label={'Ultimates used'} left={left.ultimateCasts}
                                                 right={right.ultimateCasts} leftTeam={left.teamId}
                                                 rightTeam={right.teamId} />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value={'spike'}>
                                    <AccordionTrigger className={'text-sm'}>Spike</AccordionTrigger>
                                    <AccordionContent>
                                        <StatRow label={'Planted'} left={left.plants} right={right.plants}
                                                 leftTeam={left.teamId} rightTeam={right.teamId} />
                                        <StatRow label={'Defused'} left={left.defuses} right={right.defuses}
                                                 leftTeam={left.teamId} rightTeam={right.teamId} />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value={'loadout'} className={'border-b-0'}>
                                    <AccordionTrigger className={'text-sm'}>Loadout</AccordionTrigger>
                                    <AccordionContent>
                                        <StatRow
                                            label={'Avg loadout value'}
                                            left={left.avgLoadoutValue}
                                            right={right.avgLoadoutValue}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                        <StatRow
                                            label={'Avg spend'}
                                            left={left.avgSpend}
                                            right={right.avgSpend}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value={'performance'} className={'border-b-0'}>
                                    <AccordionTrigger className={'text-sm'}>Performance</AccordionTrigger>
                                    <AccordionContent>
                                        <StatRow
                                            label={'Performance Score'}
                                            left={left.performance?.totalScore}
                                            right={right.performance?.totalScore}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Damage score'}
                                            left={left.performance?.fightStats?.damage?.value}
                                            right={right.performance?.fightStats?.damage?.value}
                                            format={number0}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Trade score'}
                                            left={left.performance?.fightStats?.trades?.value}
                                            right={right.performance?.fightStats?.trades?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Kill impact'}
                                            left={left.performance?.fightStats?.kills_adj?.value}
                                            right={right.performance?.fightStats?.kills_adj?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Death impact'}
                                            left={left.performance?.fightStats?.deaths_adj?.value}
                                            right={right.performance?.fightStats?.deaths_adj?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Assist score'}
                                            left={left.performance?.supportStats?.assists?.value}
                                            right={right.performance?.supportStats?.assists?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Utility score'}
                                            left={left.performance?.supportStats?.utilityUsage?.value}
                                            right={right.performance?.supportStats?.utilityUsage?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                        <StatRow
                                            label={'Plant score'}
                                            left={left.performance?.supportStats?.plants?.value}
                                            right={right.performance?.supportStats?.plants?.value}
                                            format={number2}
                                            leftTeam={left.teamId}
                                            rightTeam={right.teamId}
                                        />

                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}