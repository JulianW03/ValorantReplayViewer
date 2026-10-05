import { Module } from '@nestjs/common';
import { RiotClientModule } from '@/core/riotclient/RiotClientModule';
import { ProductSessionModule } from '@/modules/ProductSessionModule/ProductSessionModule';
import { ValorantGameSessionModule } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionModule';
import { AccountNameAndTagLineModule } from '@/modules/Account/AccountNameAndTagLineModule/AccountNameAndTagLineModule';
import { EntitlementTokenModule } from '@/modules/EntitlementTokenModule/EntitlementTokenModule';
import { ValorantMatchStatsModule } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsModule';
import { EventBusModule } from '@/core/events/EventBusModule';
import { ConfigModule } from '@nestjs/config';
import { ReplayModule } from '@/modules/Valorant/ValorantReplays/ReplayModule';
import { ValorantGameLoopModule } from '@/modules/Valorant/ValorantGameLoopModule/ValorantGameLoopModule';
import { RiotValorantAPIModule } from '@/integrations/riot/RiotValorantAPIModule';
import { ValorantAssetAPIModule } from '@/integrations/NotOfficer/ValorantAssetAPIModule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MapAssetResolverModule } from '@/modules/AssetResolving/Maps/MapAssetResolverModule';
import { StaticAssetProxyModule } from '@/modules/AssetProxyModule/StaticAssetProxyModule';
import { ValorantVersionInfoModule } from '@/modules/Valorant/ValorantVersionInfo/ValorantVersionInfoModule';
import { ConfigurationModule } from '@/config/ConfigurationModule';
import { getPackageAwarePath } from '@/utils/PackagedPath';
import { PuuidToPlayerAliasModule } from '@/modules/PuuidToPlayerAliasModule/PuuidToPlayerAliasModule';
import { ShutdownModule } from '@/modules/ShutdownModule/ShutdownModule';
import { AgentAssetResolverModule } from '@/modules/AssetResolving/Agents/AgentAssetResolverModule';
import { WeaponAssetResolverModule } from '@/modules/AssetResolving/Weapons/WeaponAssetResolverModule';
import { GearAssetResolverModule } from '@/modules/AssetResolving/Gear/GearAssetResolverModule';
import { AccountPuuidModule } from '@/modules/Account/AccountPuuidModule/AccountPuuidModule';
import { ValorantMatchHistoryModule } from '@/modules/Valorant/MatchHistory/MatchHistoryModule';
import { SocialPresenceModule } from '@/modules/SocialPresence/SocialPresenceModule';
import { PathProviderModule } from '@/modules/PathProvider/PathProviderModule';
import { LoggingModule } from '@/core/logging/LoggingModule';

export const APP = Symbol('APP');

@Module({
    imports: [
        ServeStaticModule.forRoot({
            rootPath: getPackageAwarePath('public'),
            serveRoot: '/',
        }),
        ConfigurationModule,
        RiotClientModule,
        ProductSessionModule,
        AccountNameAndTagLineModule,
        AccountPuuidModule,
        ValorantGameSessionModule,
        PuuidToPlayerAliasModule,
        EntitlementTokenModule,
        ValorantMatchStatsModule,
        ValorantGameLoopModule,
        ValorantMatchHistoryModule,
        SocialPresenceModule,
        RiotValorantAPIModule,
        ValorantAssetAPIModule,
        MapAssetResolverModule,
        AgentAssetResolverModule,
        WeaponAssetResolverModule,
        GearAssetResolverModule,
        StaticAssetProxyModule,
        ValorantVersionInfoModule,
        ShutdownModule,
        EventBusModule,
        ReplayModule,
        PathProviderModule,
        LoggingModule,
    ],
})
export class AppModule {
}
