import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMatchStats, useTriggerMatchStatsFetch } from '@/lib/queries';

import { MatchDetailsPanel } from '@/components/match-details/MatchDetailsPanel.tsx';

interface MatchStatsPanelProps {
    matchId: string;
}

export function MatchStatsPanel({ matchId }: MatchStatsPanelProps) {
    const { data: stats, isLoading, isError } = useMatchStats(matchId);
    const { mutate: triggerFetch, isPending: isTriggering } = useTriggerMatchStatsFetch();

    if (isLoading) {
        return (
            <div className="border-t border-border/50 px-4 pb-4 pt-3 flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="border-t border-border/50 px-4 pb-4 pt-3">
                <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    Failed to load match stats.
                </p>
            </div>
        );
    }

    // Not cached in backend yet — offer to trigger a fetch
    if (stats === null || stats === undefined) {
        return (
            <div className="border-t border-border/50 px-4 pb-4 pt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Match stats not available for this match.</p>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isTriggering}
                    onClick={() => triggerFetch(matchId)}
                >
                    {isTriggering ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Fetch Stats
                </Button>
            </div>
        );
    }

    if (stats.type === 'PENDING') {
        return (
            <div
                className="border-t border-border/50 px-4 pb-4 pt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                Fetching match data from Valorant servers…
            </div>
        );
    }


    if (stats.type === 'FAILURE') {
        return (
            <div className="border-t border-border/50 px-4 pb-4 pt-3 flex items-center justify-between">
                <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    {stats.error.message || 'Failed to fetch match data.'}
                </p>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isTriggering}
                    onClick={() => triggerFetch(matchId)}
                >
                    {isTriggering ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Retry
                </Button>
            </div>
        );
    }

    const { matchInfo, players, teams } = stats.data.matchMetadata;
    const playerEx = players.map(it => {
        const entry = stats.data.puuidResolver[it.subject];

        return {
            ...it,
            gameName: entry?.gameName,
            tagLine: entry?.tagLine,
        };
    });

    return (
        <MatchDetailsPanel matchInfo={matchInfo} players={playerEx} teams={teams || []} />
    );
}
