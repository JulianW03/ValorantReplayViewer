import { describe, expect, it } from 'vitest';
import { availableParts, downloadableParts, isComplete, PartDownloadState } from '@vrv/shared';

const { MISSING, DOWNLOADING, STORED, FAILED } = PartDownloadState;
const withReplay = availableParts({ isReplayRecorded: true });
const withoutReplay = availableParts({ isReplayRecorded: false });

describe('match parts', () => {
    it('offers every available part of a match that is not stored yet', () => {
        expect(downloadableParts(undefined, withReplay)).toEqual(['stats', 'replay']);
        expect(downloadableParts(undefined, withoutReplay)).toEqual(['stats']);
    });

    it('offers missing and failed parts, but not stored or downloading ones', () => {
        expect(downloadableParts({ stats: STORED, replay: FAILED }, withReplay)).toEqual(['replay']);
        expect(downloadableParts({ stats: MISSING, replay: DOWNLOADING }, withReplay)).toEqual(['stats']);
    });

    it('treats a match as complete once every available part is stored', () => {
        expect(isComplete({ stats: STORED, replay: MISSING }, withReplay)).toBe(false);
        expect(isComplete({ stats: STORED, replay: MISSING }, withoutReplay)).toBe(true);
        expect(isComplete({ stats: STORED, replay: STORED }, withReplay)).toBe(true);
        expect(isComplete(undefined, withoutReplay)).toBe(false);
    });
});
