import { type QueueSelection, QueueSelectionTypeSchema } from '../schemas/replays/AutoArchive.schema';

export function selectionIncludesQueue(selection: QueueSelection, queueId: string): boolean {
    const normalizedQueueId = queueId.trim().toLowerCase();

    switch (selection.type) {
        case QueueSelectionTypeSchema.enum.ALL:
            return true;
        case QueueSelectionTypeSchema.enum.SELECTED_ONLY:
            return selection.includedQueueIds.includes(normalizedQueueId);
        case QueueSelectionTypeSchema.enum.NON_SELECTED:
            return !selection.excludedQueueIds.includes(normalizedQueueId);
        case QueueSelectionTypeSchema.enum.NONE:
            return false;
    }
}
