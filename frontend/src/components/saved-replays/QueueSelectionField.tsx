import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QUEUE_ID_PRESETS } from '@/lib/queueIds';
import type { QueueSelectionDraft } from '@/lib/queueSelectionDraft';
import { QueueIdSchema, type QueueSelectionType, QueueSelectionTypeSchema } from '@vrv/shared';

const { ALL, SELECTED_ONLY, NON_SELECTED, NONE } = QueueSelectionTypeSchema.enum;

const MODE_LABELS: Record<QueueSelectionType, string> = {
    [ALL]: 'All matches',
    [SELECTED_ONLY]: 'Only selected',
    [NON_SELECTED]: 'All except selected',
    [NONE]: 'Never',
};

interface QueueSelectionFieldProps {
    label: string;
    description: string;
    value: QueueSelectionDraft;
    disabled?: boolean;
    onChange: (value: QueueSelectionDraft) => void;
}

export function QueueSelectionField({ label, description, value, disabled, onChange }: QueueSelectionFieldProps) {
    const [customQueueId, setCustomQueueId] = useState('');

    const presetIds = QUEUE_ID_PRESETS.map((preset) => preset.id);
    const customQueueIds = value.queueIds.filter((id) => !presetIds.includes(id));
    const needsQueues = value.type === SELECTED_ONLY || value.type === NON_SELECTED;

    function setQueueIds(queueIds: string[]) {
        onChange({ ...value, queueIds });
    }

    function togglePreset(id: string, isChecked: boolean) {
        setQueueIds(isChecked ? [...value.queueIds, id] : value.queueIds.filter((queueId) => queueId !== id));
    }

    function addCustomQueueId() {
        const parsed = QueueIdSchema.safeParse(customQueueId);
        if (!parsed.success || parsed.data.length === 0) return;

        if (!value.queueIds.includes(parsed.data)) {
            setQueueIds([...value.queueIds, parsed.data]);
        }
        setCustomQueueId('');
    }

    return (
        <div className="flex flex-col gap-3 border-b border-border py-4 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
                <Select
                    value={value.type}
                    disabled={disabled}
                    onValueChange={(type) => onChange({ ...value, type: type as QueueSelectionType })}
                >
                    <SelectTrigger size="sm" className="w-56" aria-label={`${label} mode`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {QueueSelectionTypeSchema.options.map((type) => (
                            <SelectItem key={type} value={type}>
                                {MODE_LABELS[type]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {needsQueues && (
                <div className="flex flex-col gap-3 rounded-md bg-muted/20 p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {QUEUE_ID_PRESETS.map((preset) => (
                            <label key={preset.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={value.queueIds.includes(preset.id)}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => togglePreset(preset.id, checked === true)}
                                />
                                {preset.label}
                            </label>
                        ))}
                    </div>

                    {customQueueIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {customQueueIds.map((id) => (
                                <Badge key={id} variant="secondary" className="gap-1 font-mono">
                                    {id}
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`Remove queue ${id}`}
                                        onClick={() => setQueueIds(value.queueIds.filter((queueId) => queueId !== id))}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Input
                            value={customQueueId}
                            disabled={disabled}
                            placeholder="Custom queue ID, e.g. for a new game mode"
                            aria-label={`Custom queue ID for ${label}`}
                            className="h-8 font-mono text-xs"
                            onChange={(event) => setCustomQueueId(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addCustomQueueId();
                                }
                            }}
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={disabled || customQueueId.trim().length === 0}
                            onClick={addCustomQueueId}
                        >
                            Add
                        </Button>
                    </div>

                    {value.queueIds.length === 0 && (
                        <p className="text-xs text-destructive">Select at least one option.</p>
                    )}
                </div>
            )}
        </div>
    );
}
