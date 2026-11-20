import { AlertCircle } from 'lucide-react';
import { AutoArchiveCard } from '@/components/saved-replays/AutoArchiveCard';
import { useStorageStatus } from '@/lib/queries';

export function AutoArchivePage() {
    const { data: storageStatus } = useStorageStatus();

    if (!storageStatus) {
        return null;
    }

    if (!storageStatus.isSetup) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                <AlertCircle className="size-4 shrink-0" />
                Initialize storage under Saved Matches to use Auto Archive.
            </div>
        );
    }

    return <AutoArchiveCard />;
}
