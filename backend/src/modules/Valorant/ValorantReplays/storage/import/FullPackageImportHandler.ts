import { ImportData, ImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/ImportHandler';
import { ReplayFileTypeSchema, ReplayImportRequest, ReplayMetadataV2, ReplayMetadataV2Schema } from '@vrv/shared';
import { InvalidReplayArchiveError } from '@/modules/Valorant/ValorantReplays/storage/ReplayStorageErrors';
import AdmZip from 'adm-zip';
import { Logger } from '@nestjs/common';

export class FullPackageImportHandler implements ImportHandler {
    private readonly logger = new Logger(FullPackageImportHandler.name);

    async import(file: Buffer, request: ReplayImportRequest): Promise<ImportData> {
        if (request.type !== ReplayFileTypeSchema.enum.package) {
            throw new Error(`FullPackageImportHandler received unexpected import type: ${request.type}`);
        }

        let zip: AdmZip;
        try {
            zip = new AdmZip(file);
        } catch {
            throw new InvalidReplayArchiveError('Invalid zip archive');
        }

        const entries = zip.getEntries();

        if (entries.length === 0) {
            throw new InvalidReplayArchiveError('No files found in archive');
        }

        const metadata = await this.handleMetadata(entries);

        let replayBuffer: Buffer | undefined = undefined;
        if (!!metadata.replayFileMetadata) {
            replayBuffer = await this.handleReplayFile(entries);
        }

        if (request.userMetadata) {
            metadata.userMetadata = request.userMetadata;
        }

        return {
            metadata: metadata,
            replayFile: replayBuffer
        }
    }

    private async handleMetadata(entries: AdmZip.IZipEntry[]): Promise<ReplayMetadataV2> {
        const metadataEntry = entries.find((e) =>
            e.entryName.endsWith('metadata.json'),
        );

        if (!metadataEntry) {
            throw new InvalidReplayArchiveError('metadata.json not found in archive');
        }

        let metadata: ReplayMetadataV2;
        try {
            metadata = await ReplayMetadataV2Schema.parseAsync(
                JSON.parse(metadataEntry.getData().toString('utf-8')),
            );
        } catch (e) {
            this.logger.error(`Error parse metadata`, e);
            throw new InvalidReplayArchiveError('Failed to parse metadata.json');
        }

        return metadata;
    }

    private async handleReplayFile(entries: AdmZip.IZipEntry[]): Promise<Buffer> {
        const replayEntry = entries.find((e) => e.entryName.endsWith('.vrf'));

        if (!replayEntry) {
            throw new InvalidReplayArchiveError('.vrf file not found in archive');
        }

        return replayEntry.getData();
    }
}
