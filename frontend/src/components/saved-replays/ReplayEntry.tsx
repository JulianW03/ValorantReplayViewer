import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDeleteMatch, useUpdateUserMetadata, useUserMetadata } from '@/lib/queries';
import { API_BASE, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/hooks/useRelativeTime';
import { mapDisplayName, truncateId } from './formatters';
import { useAppStore } from '@/store/useAppStore';
import { OutdatedTag } from '@/components/OutdatedTag';
import type { ImportFlowId, ReplayMetadataV2 } from '@vrv/shared';

import { ReplayEntryMenu } from './ReplayEntryMenu';
import { ReplayEntryEditForm } from './ReplayEntryEditForm';
import { ReplayEntryDetails } from './ReplayEntryDetails';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton';

// Shared grid layout — applied to both the header row and each entry's
// summary row so columns stay aligned. Columns: queue | map | player | stored | status+controls
export const GRID_COLS = '6rem 1fr 10rem 8rem 1fr' as const;

export const ReplayRowButtons = {
    INJECT: 'inject',
    DOWNLOAD: 'download',
    DETAILS: 'details',
    EDIT: 'edit',
    DELETE: 'delete',
} as const;

export type ReplayRowButton = (typeof ReplayRowButtons)[keyof typeof ReplayRowButtons];

interface ReplayEntryProps {
    replay: ReplayMetadataV2;
    shownButtons?: ReplayRowButton[];
    defaultExpanded?: boolean;
}

const IMPORT_FLOW_LABELS: Record<ImportFlowId, string> = {
    MANUAL_DOWNLOAD: 'Downloaded manually',
    AUTO_ARCHIVE: 'Auto-archived',
    INJECTION_PLACEHOLDER: 'Injection Placeholder',
    FILE_UPLOAD: 'Uploaded',
};

// Small helper so every "we don't have this piece of data" case renders
// the same way instead of each field inventing its own placeholder.
function Fallback({ label = '—' }: { label?: string }) {
    return <span className="text-muted-foreground/50">{label}</span>;
}

export function ReplayEntry({
                                replay,
                                shownButtons = Object.values(ReplayRowButtons),
                                defaultExpanded = false,
                            }: ReplayEntryProps) {
    const [isOpen, setIsOpen] = useState(defaultExpanded);
    const [editing, setEditing] = useState(false);
    const { mutate: deleteMatch, isPending: isDeleting } = useDeleteMatch();
    const matchId = replay.uuid;
    const editable = useUserMetadata(matchId, editing);
    const updateUserMetadata = useUpdateUserMetadata();

    const matchInfo = replay.riotMatchMetadata?.matchMetadata?.matchInfo;
    const hasMatchData = matchInfo !== undefined;

    const downloadedAt = replay.downloaderMetadata?.downloadedAt;
    const storedAt = useRelativeTime(downloadedAt || 0);

    const mapAsset = useAppStore((s) => (matchInfo?.mapId ? s.mapRegistry?.[matchInfo.mapId] ?? null : null));

    const downloaderId = replay.downloaderMetadata?.downloaderId;
    const playerAlias = downloaderId ? replay.riotMatchMetadata?.puuidResolver?.[downloaderId] : undefined;

    const userMetadata = replay.userMetadata;
    const displayName = userMetadata?.name?.trim() || `Replay ${truncateId(matchId)}`;

    const downloadHref = `${API_BASE}/plugins/replay/storage/matches/${matchId}`;

    function startEditing() {
        updateUserMetadata.reset();
        setEditing(true);
    }

    function stopEditing() {
        updateUserMetadata.reset();
        setEditing(false);
    }

    function handleSave(patch: { name: string; tags: string[]; notes: string }) {
        if (!editable.data) return;
        updateUserMetadata.mutate(
            {
                matchId,
                patch: { ...patch, notes: patch.notes.trim() ? patch.notes : null },
                etag: editable.data.etag,
            },
            { onSuccess: () => setEditing(false) },
        );
    }

    function reloadEditable() {
        updateUserMetadata.reset();
        void editable.refetch();
    }

    const saveError = updateUserMetadata.error;
    const editError = saveError instanceof ApiError && saveError.status === 412 ? (
        <>
            This replay was changed elsewhere.{' '}
            <button type="button" className="underline" onClick={reloadEditable}>
                Reload the latest version
            </button>
        </>
    ) : saveError?.message;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="rounded-lg border border-border/50 bg-card overflow-hidden"
        >
            <div className="flex items-center gap-2 px-4 py-2">
                <span className="truncate text-sm font-medium" title={displayName}>
                    {displayName}
                </span>
                {userMetadata?.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {userMetadata.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                ) : null}
                {replay.importFlowId && (
                    <Badge variant="outline" className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">
                        {IMPORT_FLOW_LABELS[replay.importFlowId]}
                    </Badge>
                )}
            </div>

            {/* Summary row */}
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
                            backgroundPosition: 'center left',
                            maskImage: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                        }}
                    />
                )}

                <div>
                    {matchInfo?.queueID ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                            {matchInfo.queueID}
                        </span>
                    ) : (
                        <Fallback />
                    )}
                </div>

                {/* Map */}
                <div className="truncate text-xs text-muted-foreground"
                     title={mapAsset?.displayName ?? matchInfo?.mapId}>
                    {hasMatchData ? (mapAsset?.displayName ?? mapDisplayName(matchInfo!.mapId)) : (
                        <span className="text-muted-foreground/50 italic">No match data</span>
                    )}
                </div>

                {/* Player */}
                <div className="text-xs text-muted-foreground">
                    {playerAlias ? (
                        <>
                            <span className="font-medium">{playerAlias.gameName}</span>
                            <span className="text-muted-foreground">#{playerAlias.tagLine}</span>
                        </>
                    ) : (
                        <Fallback />
                    )}
                </div>

                {/* Stored at */}
                <div
                    className="text-xs text-muted-foreground"
                    title={downloadedAt ? new Date(downloadedAt).toLocaleString() : undefined}
                >
                    {downloadedAt ? storedAt : <Fallback />}
                </div>

                {/* Status + controls — paired in one cell, mirroring the mockup's
                    "label on the left, icon cluster on the right" last column. */}
                <div className="flex items-center justify-end">
                    <div className="flex items-center px-2">
                        <OutdatedTag matchGameVersion={matchInfo?.gameVersion || null} />
                    </div>

                    <div className="flex items-center gap-3">
                        {
                            shownButtons.length !== 0 && (
                                <ReplayEntryMenu
                                    replay={replay}
                                    shownButtons={shownButtons}
                                    isDeleting={isDeleting}
                                    downloadHref={downloadHref}
                                    downloadFilename={`${matchId}.vrp`}
                                    onEdit={startEditing}
                                    onDelete={() => deleteMatch(matchId)}
                                />
                            )
                        }
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
            </div>

            {editing && (editable.data ? (
                <ReplayEntryEditForm
                    key={editable.data.etag}
                    initialName={editable.data.data.name}
                    initialTags={editable.data.data.tags}
                    initialNotes={editable.data.data.notes ?? ''}
                    isSaving={updateUserMetadata.isPending}
                    error={editError}
                    onCancel={stopEditing}
                    onSave={handleSave}
                />
            ) : editable.isError ? (
                <div className="border-t border-border/50 px-4 py-3 text-xs text-destructive">
                    Could not load replay details for editing: {editable.error.message}
                </div>
            ) : (
                <Skeleton className="mx-4 my-3 h-40 rounded-md" />
            ))}

            <CollapsibleContent>
                <ReplayEntryDetails replay={replay} highlightPlayer={downloaderId} />
            </CollapsibleContent>
        </Collapsible>
    );
}