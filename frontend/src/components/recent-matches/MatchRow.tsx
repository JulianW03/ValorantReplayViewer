import { useState } from 'react';
import { CheckCircle2, ChevronLeft, Download, Loader2, VideoOff, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDownloadStateFlags, useRetryDownload, useTriggerDownload } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { mapDisplayName } from '@/components/saved-replays/formatters';
import { MatchStatsPanel } from './MatchStatsPanel';
import { useAppStore } from '@/store/useAppStore';
import { useRelativeTime } from '@/hooks/useRelativeTime.ts';
import { OutdatedTag } from '@/components/OutdatedTag';
import type { MatchPart, RiotMatchApiResponseDTO } from '@vrv/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

export const GRID_COLS = '7rem 6rem 1fr 8rem 6rem' as const;

const PART_LABELS: Record<MatchPart, string> = {
    stats: 'stats',
    replay: 'replay',
};

function formatDate(millis: number): string {
    return new Date(millis).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface DownloadButtonProps {
    canDownload: boolean;
    isDownloading: boolean;
    isFailed: boolean;
    isComplete: boolean;
    isPartial: boolean;
    missingParts: MatchPart[];
    onDownload: () => void;
    onRetry: () => void;
}

function DownloadButton({
                            canDownload,
                            isDownloading,
                            isFailed,
                            isComplete,
                            isPartial,
                            missingParts,
                            onDownload,
                            onRetry,
                        }: DownloadButtonProps) {

    if (isDownloading) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <Button size="icon-sm" variant="ghost" disabled>
                        <Loader2 className="animate-spin" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    Downloading ...
                </TooltipContent>
            </Tooltip>

        );
    }

    if (isComplete) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <span className="flex items-center justify-center size-7 text-green-500">
                        <CheckCircle2 className="size-4" />
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    Downloaded
                </TooltipContent>
            </Tooltip>

        );
    }

    if (isFailed) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <Button size="icon-sm" variant="ghost" onClick={onRetry}>
                        <XCircle className="size-4 text-destructive" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <div>
                        Something went wrong
                        <br />
                        Click to retry the download
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    }
    return (
        <Tooltip>
            <TooltipTrigger>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={!canDownload}
                    onClick={onDownload}
                >
                    <Download />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {isPartial
                    ? `Download missing ${missingParts.map((part) => PART_LABELS[part]).join(' and ')}`
                    : 'Download match data'}
            </TooltipContent>
        </Tooltip>

    );
}

interface MatchRowProps {
    match: RiotMatchApiResponseDTO;
}

export function MatchRow({ match }: MatchRowProps) {
    const [isOpen, setIsOpen] = useState(false);
    const matchId = match.matchInfo.matchId;

    const { canDownload, isDownloading, isFailed, isComplete, isPartial, missingParts } =
        useDownloadStateFlags(matchId, match.matchInfo);

    const { mutate: triggerDownload } = useTriggerDownload();
    const { mutate: retryDownload } = useRetryDownload();
    const relativeTime = useRelativeTime(match.matchInfo.gameStartMillis);

    const matchStats = useAppStore((s) => s.matchStatsCache?.[matchId]);
    const mapId = matchStats?.type === 'SUCCESS' ? matchStats.data.matchMetadata.matchInfo.mapId : null;
    const mapAsset = useAppStore((s) => (mapId ? s.mapRegistry?.[mapId] ?? null : null));
    const matchGameVersion = matchStats?.type === 'SUCCESS' ? matchStats.data.matchMetadata.matchInfo.gameVersion : null;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="rounded-lg border border-border/50 bg-card overflow-hidden"
        >
            <div
                className="relative isolate grid items-center gap-3 px-4 py-5 text-sm"
                style={{ gridTemplateColumns: GRID_COLS }}
            >
                {mapAsset?.splash && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -z-10"
                        style={{
                            backgroundImage: `url(${mapAsset.splash})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center center',
                            maskImage:
                                'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                            WebkitMaskImage:
                                'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                        }}
                    />
                )}

                <div>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {match.matchInfo.queueID || 'Unknown'}
                    </span>
                </div>

                <div
                    className="text-xs text-muted-foreground truncate"
                    title={mapAsset?.displayName ?? mapId ?? undefined}
                >
                    {mapId ? (mapAsset?.displayName ?? mapDisplayName(mapId)) : '—'}
                </div>

                <div className="text-xs text-muted-foreground">
                    {formatDate(match.matchInfo.gameStartMillis)} · {relativeTime}
                </div>
                <div className="flex items-center">
                    <OutdatedTag matchGameVersion={matchGameVersion} />
                </div>
                <div className="flex items-center gap-1">
                    {
                        !match.matchInfo.isReplayRecorded ?
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <span className={'flex items-center justify-center size-7 text-amber-400'}>
                                    <VideoOff className={'size-4'} />
                                </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    No Replay available
                                </TooltipContent>
                            </Tooltip>
                            :
                            <span className={'flex items-center justify-center size-7'} />
                    }
                    <DownloadButton
                        canDownload={canDownload}
                        isDownloading={isDownloading}
                        isFailed={isFailed}
                        isComplete={isComplete}
                        isPartial={isPartial}
                        missingParts={missingParts}
                        onDownload={() => triggerDownload(matchId)}
                        onRetry={() => retryDownload(matchId)}
                    />
                    <CollapsibleTrigger asChild>
                        <Button size="icon-sm" variant="ghost" title="Show match details">
                            <ChevronLeft
                                className={cn(
                                    'transition-transform duration-150',
                                    isOpen && '-rotate-90',
                                )}
                            />
                        </Button>
                    </CollapsibleTrigger>
                </div>
            </div>

            <CollapsibleContent>
                {isOpen && <MatchStatsPanel matchId={matchId} />}
            </CollapsibleContent>
        </Collapsible>
    );
}