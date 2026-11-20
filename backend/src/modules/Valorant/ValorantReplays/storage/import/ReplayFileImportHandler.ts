import { createHash } from 'node:crypto';
import { ImportData, ImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/ImportHandler';
import {
    CURRENT_REPLAY_FORMAT_VERSION,
    ReplayFileTypeSchema,
    ReplayImportRequest,
    ReplayMetadataV2,
} from '@vrv/shared';
import { Logger } from '@nestjs/common';
import { InvalidReplayArchiveError } from '@/modules/Valorant/ValorantReplays/storage/ReplayStorageErrors';

const UUID_OFFSET = 0x30;
const UUID_LENGTH = 36 * 2;

export class ReplayFileImportHandler implements ImportHandler {
    private readonly logger = new Logger(ReplayFileImportHandler.name);

    async import(file: Buffer, request: ReplayImportRequest): Promise<ImportData> {
        if (request.type !== ReplayFileTypeSchema.enum.replayFile) {
            this.logger.error(`ReplayFileImportHandler received unexpected import type: ${request.type}`);
            throw new Error(`ReplayFileImportHandler received unexpected import type: ${request.type}`);
        }

        if (file.length < UUID_OFFSET + UUID_LENGTH) {
            throw new InvalidReplayArchiveError('Unable to extract replay Match UUID');
        }
        const matchUuid = file.subarray(UUID_OFFSET, UUID_OFFSET + UUID_LENGTH).toString('utf16le');
        this.logger.debug(`Extracted Match UUID: ${matchUuid}`);
        const checksum = createHash('sha256').update(file).digest('hex');
        const concatId = matchUuid.substring(0, 8);

        const metadata: ReplayMetadataV2 = {
            formatVersion: CURRENT_REPLAY_FORMAT_VERSION,
            uuid: matchUuid,
            replayFileMetadata: {
                fileSizeBytes: file.byteLength,
                checksum,
            },
            riotMatchMetadata: null,
            downloaderMetadata: null,
            userMetadata: request.userMetadata ?? {
                name: `Replay ${concatId}`,
                tags: [],
                notes: null,
            },
        };

        return { metadata, replayFile: file };
    }
}
