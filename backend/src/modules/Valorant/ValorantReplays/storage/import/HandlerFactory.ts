import { ReplayFileType, ReplayFileTypeSchema } from '@vrv/shared';
import { ImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/ImportHandler';
import { FullPackageImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/FullPackageImportHandler';
import { MatchdataJsonImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/MatchdataJsonImportHandler';
import { ReplayFileImportHandler } from '@/modules/Valorant/ValorantReplays/storage/import/ReplayFileImportHandler';
import { PuuidToPlayerAliasManager } from '@/modules/PuuidToPlayerAliasModule/PuuidToPlayerAliasManager';

export const forType = (
    type: ReplayFileType,
    puuidManager: PuuidToPlayerAliasManager,
): ImportHandler => {
    switch (type) {
        case ReplayFileTypeSchema.enum.package:
            return new FullPackageImportHandler();
        case ReplayFileTypeSchema.enum.riotMetadata:
            return new MatchdataJsonImportHandler(puuidManager);
        case ReplayFileTypeSchema.enum.replayFile:
            return new ReplayFileImportHandler();
        default:
            throw new Error(`Unsupported import type: ${type}`);
    }
}
