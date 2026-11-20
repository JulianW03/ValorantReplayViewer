import { toast } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { type AutoArchiveProgress, AutoArchiveProgressStateSchema } from '@vrv/shared';

const { SAVING, SAVED, FAILED } = AutoArchiveProgressStateSchema.enum;

type StoredParts = Extract<AutoArchiveProgress, { stored: unknown }>['stored'];

function describeStored({ stats, replay }: StoredParts): string {
    if (stats && replay) return 'Stats and replay saved.';
    return stats ? 'Stats saved.' : 'Replay saved.';
}

function describeFailure(stored: StoredParts): string {
    return stored.stats || stored.replay
        ? `${describeStored(stored)} Download the rest from Recent Matches.`
        : 'Nothing was saved. You can still download it from Recent Matches.';
}

export function showAutoArchiveProgress(matchId: string, progress: AutoArchiveProgress): void {
    switch (progress.state) {
        case SAVING:
            toast.info('Auto-archiving a finished match…', { id: matchId });
            return;
        case SAVED:
            toast.success('Match auto-archived', { id: matchId, description: describeStored(progress.stored) });
            break;
        case FAILED:
            toast.error("Couldn't finish auto-archiving a match", {
                id: matchId,
                description: describeFailure(progress.stored),
                duration: Infinity,
            });
            break;
    }

    void queryClient.invalidateQueries({ queryKey: ['storedMatches'] });
    void queryClient.invalidateQueries({ queryKey: ['storageStatus'] });
}
