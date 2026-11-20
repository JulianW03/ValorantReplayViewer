import { Controller } from '@nestjs/common';
import { MapAssetResolverManager, MapId } from '@/modules/AssetResolving/Maps/MapAssetResolverManager';
import { AssetResolverController } from '@/modules/AssetResolving/common/AssetResolverController';
import { MapAssetDTO } from '@vrv/shared';

@Controller({
    path: 'assets/maps',
    version: '1',
})
export class MapAssetResolverController extends AssetResolverController<MapId, MapAssetDTO> {
    constructor(assetResolver: MapAssetResolverManager) {
        super(assetResolver, 'Map');
    }
}
