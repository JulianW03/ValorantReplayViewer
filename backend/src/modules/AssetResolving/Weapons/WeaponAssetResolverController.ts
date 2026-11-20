import { Controller } from '@nestjs/common';
import { WeaponAssetResolverManager, WeaponId } from '@/modules/AssetResolving/Weapons/WeaponAssetResolverManager';
import { AssetResolverController } from '@/modules/AssetResolving/common/AssetResolverController';
import { WeaponAssetDTO } from '@vrv/shared';

@Controller({
    path: 'assets/weapons',
    version: '1',
})
export class WeaponAssetResolverController extends AssetResolverController<WeaponId, WeaponAssetDTO> {
    constructor(assetResolver: WeaponAssetResolverManager) {
        super(assetResolver, 'Weapon');
    }
}
