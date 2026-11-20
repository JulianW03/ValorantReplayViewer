import { Controller } from '@nestjs/common';
import { AgentAssetResolverManager, AgentId } from '@/modules/AssetResolving/Agents/AgentAssetResolverManager';
import { AssetResolverController } from '@/modules/AssetResolving/common/AssetResolverController';
import { AgentAssetDTO } from '@vrv/shared';

@Controller({
    path: 'assets/agents',
    version: '1',
})
export class AgentAssetResolverController extends AssetResolverController<AgentId, AgentAssetDTO> {
    constructor(assetResolver: AgentAssetResolverManager) {
        super(assetResolver, 'Agent');
    }
}
