import { useState } from 'react';
import { BugPlay, Download, ExternalLink, Loader2, Pencil, Settings, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { cn } from '@/lib/utils';
import { truncateId } from './formatters';
import { type ReplayRowButton, ReplayRowButtons } from './ReplayEntry';
import type { ReplayMetadataV2 } from '@vrv/shared';
import { useInjectReplay } from '@/hooks/useInjectReplay.ts';
import { InjectTooltip } from '@/components/saved-replays/InjectTooltip.tsx';
import { Button } from '@/components/ui/button.tsx';

interface ReplayEntryMenuProps {
    replay: ReplayMetadataV2;
    shownButtons: ReplayRowButton[];
    isDeleting: boolean;
    downloadHref: string;
    downloadFilename: string;
    onEdit: () => void;
    onDelete: () => void;
}

export function ReplayEntryMenu({
                                    replay,
                                    shownButtons,
                                    isDeleting,
                                    downloadHref,
                                    downloadFilename,
                                    onEdit,
                                    onDelete,
                                }: ReplayEntryMenuProps) {
    const { inject, isInjecting, disabledInfo } = useInjectReplay(replay);
    const [open, setOpen] = useState(false);

    const showInject = shownButtons.includes(ReplayRowButtons.INJECT);
    const showDetails = shownButtons.includes(ReplayRowButtons.DETAILS) && !!replay.riotMatchMetadata;
    const showEdit = shownButtons.includes(ReplayRowButtons.EDIT);
    const showDownload = shownButtons.includes(ReplayRowButtons.DOWNLOAD);
    const showDelete = shownButtons.includes(ReplayRowButtons.DELETE);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Replay actions"
                    disabled={isDeleting}
                >
                    <Settings
                        className={cn(
                            'transition-transform duration-150 rotate-0',
                            open && '-rotate-90',
                        )} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Replay</DropdownMenuLabel>
                <InjectTooltip tooltip={disabledInfo.tooltip}>
                    <DropdownMenuItem
                        disabled={disabledInfo.isDisabled || !showInject}
                        onClick={inject}
                        className="gap-2"
                    >
                        {isInjecting ? (
                            <Loader2 className="icon-sm animate-spin" />
                        ) : (
                            <BugPlay className="icon-sm" />
                        )}
                        Inject Replay
                    </DropdownMenuItem>
                </InjectTooltip>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Details</DropdownMenuLabel>

                <DropdownMenuItem asChild disabled={!showDetails}>
                    <NavLink to={`/details/saved/${replay.uuid}`} className="gap-2 cursor-pointer">
                        <ExternalLink className="icon-sm" />
                        Match details
                    </NavLink>
                </DropdownMenuItem>

                <DropdownMenuItem disabled={!showEdit} onClick={onEdit} className="gap-2">
                    <Pencil className="icon-sm" />
                    Edit Metadata
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Replay Package</DropdownMenuLabel>
                <DropdownMenuItem asChild disabled={!showDownload}>
                    <a href={downloadHref} download={downloadFilename} className="gap-2">
                        <Download className="icon-sm" />
                        Download
                    </a>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <>
                    <ConfirmDialog
                        title="Delete replay?"
                        description={<>
                            This will permanently delete the replay for match{' '}
                            <span className="font-mono rounded-sm bg-muted px-2 py-0.5">
                                {replay.userMetadata?.name ?? truncateId(replay.uuid)}
                            </span>.
                            <br />
                            This action cannot be undone.
                        </>}
                        confirmLabel="Delete"
                        onConfirm={onDelete}
                    >
                        <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="gap-2 text-destructive focus:text-destructive"
                            disabled={!showDelete || isDeleting}
                        >
                            <Trash2 className="size-3.5" />
                            Delete replay
                        </DropdownMenuItem>
                    </ConfirmDialog>
                </>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}