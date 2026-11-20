import { Injectable } from '@nestjs/common';
import { ValorantAssetAPI } from '@/integrations/NotOfficer/ValorantAssetAPI';
import { AssetResolverManager } from '@/modules/AssetResolving/common/AssetResolverManager';
import { WeaponAssetDTO } from '@vrv/shared';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

export type WeaponId = string;

@Injectable()
export class WeaponAssetResolverManager extends AssetResolverManager<WeaponId, WeaponAssetDTO, WeaponAssetDTO> {
    constructor(
        valorantAssetAPI: ValorantAssetAPI,
        @InjectConfig()
        config: AppConfig,
    ) {
        super(valorantAssetAPI, config);
    }

    protected keyOf(entry: WeaponAssetDTO): WeaponId {
        return entry.uuid;
    }

    protected fetchEntries(): Promise<WeaponAssetDTO[]> {
        return this.valorantAssetAPI.getWeaponList();
    }
}
