import { Injectable } from '@nestjs/common';
import { ValorantAssetAPI } from '@/integrations/NotOfficer/ValorantAssetAPI';
import { AssetResolverManager } from '@/modules/AssetResolving/common/AssetResolverManager';
import { GearAssetDTO, GUID } from '@vrv/shared';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

export type GearId = GUID;

@Injectable()
export class GearAssetResolverManager extends AssetResolverManager<GearId, GearAssetDTO, GearAssetDTO> {
    constructor(
        valorantAssetAPI: ValorantAssetAPI,
        @InjectConfig()
        config: AppConfig,
    ) {
        super(valorantAssetAPI, config);
    }

    protected keyOf(entry: GearAssetDTO): GearId {
        return entry.uuid;
    }

    protected fetchEntries(): Promise<GearAssetDTO[]> {
        return this.valorantAssetAPI.getGearList();
    }
}
