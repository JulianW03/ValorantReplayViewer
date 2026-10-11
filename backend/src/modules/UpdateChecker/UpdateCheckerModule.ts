import { Module } from '@nestjs/common';
import { EventBusModule } from '@/core/events/EventBusModule';
import { UpdateCheckerManager } from '@/modules/UpdateChecker/UpdateCheckerManager';
import { UpdateCheckerController } from '@/modules/UpdateChecker/UpdateCheckerController';

@Module({
    imports: [EventBusModule],
    providers: [UpdateCheckerManager, UpdateCheckerController],
    controllers: [UpdateCheckerController],
    exports: []
})
export class UpdateCheckerModule {}