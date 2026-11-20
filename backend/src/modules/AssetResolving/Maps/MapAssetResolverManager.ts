import { Injectable } from '@nestjs/common';
import { ValorantAssetAPI } from '@/integrations/NotOfficer/ValorantAssetAPI';
import { AssetResolverManager } from '@/modules/AssetResolving/common/AssetResolverManager';
import { MapAssetDTO } from '@vrv/shared';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

export type MapId = string;

@Injectable()
export class MapAssetResolverManager extends AssetResolverManager<MapId, MapAssetDTO, MapAssetDTO> {
    constructor(
        valorantAssetAPI: ValorantAssetAPI,
        @InjectConfig()
        config: AppConfig,
    ) {
        super(valorantAssetAPI, config);
    }

    protected keyOf(entry: MapAssetDTO): MapId {
        return entry.mapUrl;
    }

    protected fetchEntries(): Promise<MapAssetDTO[]> {
        return this.valorantAssetAPI.getMapList();
    }
}
