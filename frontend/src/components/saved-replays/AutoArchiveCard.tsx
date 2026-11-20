import { useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, Info, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoArchiveSettings, useSaveAutoArchiveSettings } from '@/lib/queries';
import { fromDraft, type QueueSelectionDraft, toDraft } from '@/lib/queueSelectionDraft';
import { QueueSelectionField } from '@/components/saved-replays/QueueSelectionField';
import { type AutoArchiveSettings, AutoArchiveSettingsSchema, QueueSelectionTypeSchema } from '@vrv/shared';

const { NONE } = QueueSelectionTypeSchema.enum;

interface AutoArchiveFormProps {
    saved: AutoArchiveSettings;
    isSaving: boolean;
    status: 'idle' | 'saved' | 'failed';
    onSave: (settings: AutoArchiveSettings) => void;
}

function AutoArchiveForm({ saved, isSaving, status, onSave }: AutoArchiveFormProps) {
    const [stats, setStats] = useState<QueueSelectionDraft>(() => toDraft(saved.stats));
    const [replays, setReplays] = useState<QueueSelectionDraft>(() => toDraft(saved.replays));

    const parsed = AutoArchiveSettingsSchema.safeParse({ stats: fromDraft(stats), replays: fromDraft(replays) });
    const isDirty = !parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(saved);

    return (
        <div className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Archive className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Auto Archive</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Save matches automatically when they end. Only works while VRV is running.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {status === 'saved' && !isDirty && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                            <CheckCircle2 className="size-3.5" /> Saved
                        </span>
                    )}
                    {status === 'failed' && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="size-3.5" /> Failed to save
                        </span>
                    )}
                    <Button
                        size="sm"
                        disabled={isSaving || !isDirty || !parsed.success}
                        onClick={() => parsed.success && onSave(parsed.data)}
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                        Save
                    </Button>
                </div>
            </div>

            <div className="mt-2">
                <QueueSelectionField
                    label="Stats"
                    description="Scoreboard, rounds and economy. Small, and stays useful after a patch."
                    value={stats}
                    disabled={isSaving}
                    onChange={setStats}
                />
                <QueueSelectionField
                    label="Replays"
                    description="The replay file. Larger, and only watchable until the game updates."
                    value={replays}
                    disabled={isSaving}
                    onChange={setReplays}
                />
            </div>

            {stats.type === NONE && replays.type !== NONE && (
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    Replays saved without stats have no match details, and VRV can't check whether they still work on
                    the current patch.
                </div>
            )}
        </div>
    );
}

export function AutoArchiveCard() {
    const { data: saved, isLoading } = useAutoArchiveSettings();
    const { mutate: save, isPending, isSuccess, isError } = useSaveAutoArchiveSettings();

    if (isLoading) {
        return <Skeleton className="h-32 w-full rounded-lg" />;
    }
    if (!saved) {
        return null;
    }

    return (
        <AutoArchiveForm
            key={JSON.stringify(saved)}
            saved={saved}
            isSaving={isPending}
            status={isError ? 'failed' : isSuccess ? 'saved' : 'idle'}
            onSave={save}
        />
    );
}
