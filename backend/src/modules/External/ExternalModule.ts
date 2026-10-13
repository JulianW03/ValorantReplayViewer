import { Module } from '@nestjs/common';
import { ExternalController } from '@/modules/External/ExternalController';

@Module({
    controllers: [ExternalController],
})
export class ExternalModule {}
