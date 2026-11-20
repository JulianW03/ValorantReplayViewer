import { Controller } from '@nestjs/common';
import { GearAssetResolverManager, GearId } from '@/modules/AssetResolving/Gear/GearAssetResolverManager';
import { AssetResolverController } from '@/modules/AssetResolving/common/AssetResolverController';
import { GearAssetDTO } from '@vrv/shared';

@Controller({
    path: 'assets/gear',
    version: '1',
})
export class GearAssetResolverController extends AssetResolverController<GearId, GearAssetDTO> {
    constructor(assetResolver: GearAssetResolverManager) {
        super(assetResolver, 'Gear');
    }
}
