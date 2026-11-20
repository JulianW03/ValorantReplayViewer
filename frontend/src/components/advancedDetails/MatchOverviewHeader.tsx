import { useMapRegistry } from '@/lib/queries.ts';
import { formatDate, formatDuration } from '@/components/saved-replays/formatters.ts';
import { getOppositeTeamId, TWO_TEAM_IDS, type TWO_TEAMS_TEAM_ID } from '@vrv/shared';

export interface MatchOverviewTeam {
    roundsWon: number;
}

export interface MatchOverviewHeaderProps {
    teams: Record<TWO_TEAMS_TEAM_ID, MatchOverviewTeam>;
    mapId: string;
    winningTeam: TWO_TEAMS_TEAM_ID | undefined;
    userTeam: TWO_TEAMS_TEAM_ID | undefined;
    queueId: string;
    startTimeMillis: number;
    durationMillis: number;
}


const roundResult = (props: MatchOverviewHeaderProps) => {
    if (!props.userTeam) return null;
    if (!props.winningTeam) return <span>DRAW</span>;
    if (props.userTeam === props.winningTeam) {
        return <span className={'text-green-500'}>VICTORY</span>;
    }
    return <span className={'text-red-500'}>DEFEAT</span>;
};

export const MatchOverviewHeader = (
    {
        data,
    }: {
        data: MatchOverviewHeaderProps;
    },
) => {
    const maps = useMapRegistry();
    const result = roundResult(data);
    const map = maps?.[data.mapId];

    return (
        <div className={'w-full flex overflow-hidden h-24 gap-4 mb-4 p-3'}>
            <div className={'w-32 h-full rounded-sm overflow-hidden'}>
                <img className={'object-cover h-full w-full'}
                     src={map?.splash ?? ""} />
            </div>
            <div className={'relative text-3xl h-full flex flex-col pb-4'}>
                <div className={'flex-1 flex align-items-center justify-start h-full'}>
                    {
                        maps?.[data.mapId].displayName
                    }
                </div>
                <div className={'flex items-center gap-4 text-sm'}>
                    <span>{data.queueId}</span>
                    <span className={'w-1 h-1 rounded-full bg-[rgb(58,71,83)]'} />
                    <span>{formatDate(data.startTimeMillis)}</span>
                    <span className={'w-1 h-1 rounded-full bg-[rgb(58,71,83)]'} />
                    <span>{formatDuration(data.durationMillis)}</span>
                </div>
            </div>
            <div className={'ml-[auto] flex gap-5 items-center relative mr-2'}>
                <div className={'text-left text-3xl'}>
                    {result}
                </div>
                <div
                    className={'flex align-[baseline] gap-3 text-4xl'}>
                    <span>
                        {data.teams[data.userTeam ?? TWO_TEAM_IDS.RED].roundsWon}
                    </span>
                    <span>
                        -
                    </span>
                    <span>
                        {data.teams[getOppositeTeamId(data.userTeam ?? TWO_TEAM_IDS.RED)].roundsWon}
                    </span>
                </div>
            </div>
        </div>
    );
};