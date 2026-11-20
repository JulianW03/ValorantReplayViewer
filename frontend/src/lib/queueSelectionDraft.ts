import { type QueueSelection, type QueueSelectionType, QueueSelectionTypeSchema } from '@vrv/shared';

const { ALL, SELECTED_ONLY, NON_SELECTED, NONE } = QueueSelectionTypeSchema.enum;

/**
 * Form state for a queue selection. Keeps one list across all modes, so a user's queues survive switching between them.
 */
export interface QueueSelectionDraft {
    type: QueueSelectionType;
    queueIds: string[];
}

export function toDraft(selection: QueueSelection): QueueSelectionDraft {
    switch (selection.type) {
        case SELECTED_ONLY:
            return { type: selection.type, queueIds: selection.includedQueueIds };
        case NON_SELECTED:
            return { type: selection.type, queueIds: selection.excludedQueueIds };
        case ALL:
        case NONE:
            return { type: selection.type, queueIds: [] };
    }
}

export function fromDraft({ type, queueIds }: QueueSelectionDraft): QueueSelection {
    switch (type) {
        case SELECTED_ONLY:
            return { type, includedQueueIds: queueIds };
        case NON_SELECTED:
            return { type, excludedQueueIds: queueIds };
        case ALL:
        case NONE:
            return { type };
    }
}
