import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OriginPolicy } from '@/core/origin/OriginPolicy';
import { OriginGuard } from '@/core/origin/OriginGuard';

@Global()
@Module({
    providers: [OriginPolicy, { provide: APP_GUARD, useClass: OriginGuard }],
    exports: [OriginPolicy],
})
export class OriginModule {}
