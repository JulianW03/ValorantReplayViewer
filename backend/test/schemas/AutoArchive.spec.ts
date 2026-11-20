import { describe, expect, it } from 'vitest';
import {
    AutoArchiveSettingsSchema,
    CUSTOM_GAME_QUEUE_ID,
    type QueueSelection,
    QueueSelectionSchema,
    selectionIncludesQueue,
} from '@vrv/shared';

describe('QueueSelectionSchema', () => {
    it.each([
        ['a field of the other list variant', { type: 'SELECTED_ONLY', excludedQueueIds: ['competitive'] }],
        ['both list fields at once', {
            type: 'NON_SELECTED',
            includedQueueIds: ['competitive'],
            excludedQueueIds: ['unrated'],
        }],
        ['a list on a variant without one', { type: 'ALL', includedQueueIds: ['competitive'] }],
        ['an empty included set', { type: 'SELECTED_ONLY', includedQueueIds: [] }],
        ['an empty excluded set', { type: 'NON_SELECTED', excludedQueueIds: [] }],
        ['duplicates after normalizing', { type: 'SELECTED_ONLY', includedQueueIds: ['Competitive', ' competitive '] }],
        ['an unknown type', { type: 'SOME' }],
    ])('rejects %s', (_name, selection) => {
        expect(QueueSelectionSchema.safeParse(selection).success).toBe(false);
    });

    it('accepts custom queue IDs and normalizes them', () => {
        expect(QueueSelectionSchema.parse({ type: 'SELECTED_ONLY', includedQueueIds: [' NewMode '] }))
            .toEqual({ type: 'SELECTED_ONLY', includedQueueIds: ['newmode'] });
    });

    it('accepts custom games as the only selected option', () => {
        const selection = { type: 'SELECTED_ONLY', includedQueueIds: [CUSTOM_GAME_QUEUE_ID] };

        expect(QueueSelectionSchema.parse(selection)).toEqual(selection);
    });
});

describe('AutoArchiveSettingsSchema', () => {
    it('lets stats and replays select independently', () => {
        const settings = {
            stats: { type: 'ALL' },
            replays: { type: 'SELECTED_ONLY', includedQueueIds: ['competitive', 'premier'] },
        };

        expect(AutoArchiveSettingsSchema.parse(settings)).toEqual(settings);
    });

    it('requires both selections', () => {
        expect(AutoArchiveSettingsSchema.safeParse({ stats: { type: 'ALL' } }).success).toBe(false);
    });
});

describe('selectionIncludesQueue', () => {
    const cases: [QueueSelection, string, boolean][] = [
        [{ type: 'ALL' }, 'competitive', true],
        [{ type: 'NONE' }, 'competitive', false],
        [{ type: 'SELECTED_ONLY', includedQueueIds: ['competitive'] }, 'competitive', true],
        [{ type: 'SELECTED_ONLY', includedQueueIds: ['competitive'] }, 'unrated', false],
        [{ type: 'SELECTED_ONLY', includedQueueIds: ['newmode'] }, 'newmode', true],
        [{ type: 'SELECTED_ONLY', includedQueueIds: ['newmode'] }, ' NewMode ', true],
        [{ type: 'NON_SELECTED', excludedQueueIds: ['deathmatch'] }, 'competitive', true],
        [{ type: 'NON_SELECTED', excludedQueueIds: ['deathmatch'] }, 'deathmatch', false],
        [{ type: 'NON_SELECTED', excludedQueueIds: ['deathmatch'] }, 'DeathMatch', false],
        [{ type: 'ALL' }, CUSTOM_GAME_QUEUE_ID, true],
        [{ type: 'NONE' }, CUSTOM_GAME_QUEUE_ID, false],
        [{ type: 'SELECTED_ONLY', includedQueueIds: [CUSTOM_GAME_QUEUE_ID] }, CUSTOM_GAME_QUEUE_ID, true],
        [{ type: 'SELECTED_ONLY', includedQueueIds: [CUSTOM_GAME_QUEUE_ID] }, 'competitive', false],
        [{ type: 'SELECTED_ONLY', includedQueueIds: ['competitive'] }, CUSTOM_GAME_QUEUE_ID, false],
        [{ type: 'NON_SELECTED', excludedQueueIds: [CUSTOM_GAME_QUEUE_ID] }, CUSTOM_GAME_QUEUE_ID, false],
        [{ type: 'NON_SELECTED', excludedQueueIds: [CUSTOM_GAME_QUEUE_ID] }, 'competitive', true],
        [{ type: 'NON_SELECTED', excludedQueueIds: ['competitive'] }, CUSTOM_GAME_QUEUE_ID, true],
    ];

    it.each(cases)('%j with queue "%s" is %s', (selection, queueId, expected) => {
        expect(selectionIncludesQueue(selection, queueId)).toBe(expected);
    });
});
