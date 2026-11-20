import { ReplayImportRequest, ReplayMetadataV2 } from '@vrv/shared';

export interface ImportData {
    metadata: ReplayMetadataV2
    replayFile?: Buffer
}

export interface ImportHandler {
    import(file: Buffer, request: ReplayImportRequest): Promise<ImportData>
}

export function defaultReplayName(matchId: string): string {
    return `Replay ${matchId.substring(0, 8)}`;
}
