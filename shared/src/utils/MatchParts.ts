import {
    MATCH_PARTS,
    type MatchPart,
    type MatchParts,
    type MatchPartStates,
    PartDownloadState,
} from '../schemas/DownloadState.schema';
import type { RiotMatchInfo } from '../schemas/RiotMatchApiReponseDTO';

export function partsWhere(predicate: (part: MatchPart) => boolean): MatchParts {
    return Object.fromEntries(MATCH_PARTS.map((part) => [part, predicate(part)])) as MatchParts;
}

export function selectedParts(parts: MatchParts): MatchPart[] {
    return MATCH_PARTS.filter((part) => parts[part]);
}

export function toPartStates(stored: MatchParts): MatchPartStates {
    return Object.fromEntries(
        MATCH_PARTS.map((part) => [part, stored[part] ? PartDownloadState.STORED : PartDownloadState.MISSING]),
    ) as MatchPartStates;
}

export function availableParts(matchInfo: Pick<RiotMatchInfo, 'isReplayRecorded'>): MatchParts {
    return { stats: true, replay: matchInfo.isReplayRecorded };
}

export function downloadableParts(states: MatchPartStates | undefined, available: MatchParts): MatchPart[] {
    return MATCH_PARTS.filter((part) => {
        const state = states?.[part];
        return available[part] && state !== PartDownloadState.STORED && state !== PartDownloadState.DOWNLOADING;
    });
}

export function storedParts(states: MatchPartStates | undefined): MatchPart[] {
    return MATCH_PARTS.filter((part) => states?.[part] === PartDownloadState.STORED);
}

export function failedParts(states: MatchPartStates | undefined): MatchPart[] {
    return MATCH_PARTS.filter((part) => states?.[part] === PartDownloadState.FAILED);
}

export function isAnyDownloading(states: MatchPartStates | undefined): boolean {
    return MATCH_PARTS.some((part) => states?.[part] === PartDownloadState.DOWNLOADING);
}

export function isComplete(states: MatchPartStates | undefined, available: MatchParts): boolean {
    return MATCH_PARTS.every((part) => !available[part] || states?.[part] === PartDownloadState.STORED);
}
