import { type ReactNode, useState } from 'react';
import { FileArchive, FileJson, FileVideo } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog.tsx';
import { cn } from '@/lib/utils';
import { type ReplayFileType, ReplayFileTypeSchema } from '@vrv/shared';
import { PackageUploadForm } from '@/components/saved-replays/upload/PackageUploadForm.tsx';
import { RawReplayUploadForm } from '@/components/saved-replays/upload/RawReplayUploadForm.tsx';
import { RiotMetadataUploadForm } from '@/components/saved-replays/upload/RiotMetadataUploadForm.tsx';

const UPLOAD_TYPE_OPTIONS: {
    type: ReplayFileType;
    label: string;
    description: string;
    icon: typeof FileArchive;
}[] = [
    {
        type: ReplayFileTypeSchema.enum.package,
        label: 'Full Package',
        description: 'VRV Replay Package',
        icon: FileArchive,
    },
    {
        type: ReplayFileTypeSchema.enum.replayFile,
        label: 'Raw Replay',
        description: 'Valorant Replay File',
        icon: FileVideo,
    },
    {
        type: ReplayFileTypeSchema.enum.riotMetadata,
        label: 'Match JSON',
        description: 'Raw Riot match response',
        icon: FileJson,
    },
];

const DEFAULT_UPLOAD_TYPE = ReplayFileTypeSchema.enum.package;

export function UploadReplayDialog({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [uploadType, setUploadType] = useState<ReplayFileType>(DEFAULT_UPLOAD_TYPE);
    // Bumped whenever a form should be reset (dialog closed, upload succeeded) —
    // forces the active upload form to remount with fresh internal state.
    const [formKey, setFormKey] = useState(0);

    function resetToDefault() {
        setUploadType(DEFAULT_UPLOAD_TYPE);
        setFormKey((k) => k + 1);
    }

    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (!next) resetToDefault();
    }

    function handleUploaded() {
        setOpen(false);
        resetToDefault();
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Replay</DialogTitle>
                    <DialogDescription>
                        Choose what you're importing, then select the matching file.
                    </DialogDescription>
                </DialogHeader>

                {/* Upload type selector */}
                <div className="grid grid-cols-3 gap-2">
                    {UPLOAD_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const selected = option.type === uploadType;
                        return (
                            <button
                                key={option.type}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setUploadType(option.type)}
                                className={cn(
                                    'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors',
                                    selected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-muted-foreground/50 hover:bg-muted/20',
                                )}
                            >
                                <Icon className={cn('size-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                                <p className="text-xs font-medium">{option.label}</p>
                                <p className="text-[0.7rem] text-muted-foreground">{option.description}</p>
                            </button>
                        );
                    })}
                </div>

                {uploadType === ReplayFileTypeSchema.enum.package && (
                    <PackageUploadForm key={formKey} onUploaded={handleUploaded} />
                )}
                {uploadType === ReplayFileTypeSchema.enum.replayFile && (
                    <RawReplayUploadForm key={formKey} onUploaded={handleUploaded} />
                )}
                {uploadType === ReplayFileTypeSchema.enum.riotMetadata && (
                    <RiotMetadataUploadForm key={formKey} onUploaded={handleUploaded} />
                )}
            </DialogContent>
        </Dialog>
    );
}