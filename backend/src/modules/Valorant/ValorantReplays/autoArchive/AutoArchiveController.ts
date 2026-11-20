import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { type AutoArchiveSettings, AutoArchiveSettingsSchema } from '@vrv/shared';
import { ReplayAutoArchiveManager } from '@/modules/Valorant/ValorantReplays/autoArchive/ReplayAutoArchiveManager';

class AutoArchiveSettingsModel extends createZodDto(AutoArchiveSettingsSchema) {
}

@Controller({
    path: 'plugins/replay/auto-archive',
    version: '1',
})
export class AutoArchiveController {
    constructor(private readonly autoArchiveManager: ReplayAutoArchiveManager) {
    }

    @Get('')
    @ApiOperation({ summary: 'Get auto-archive settings' })
    @ApiOkResponse({ type: AutoArchiveSettingsModel })
    getSettings(): AutoArchiveSettings {
        return this.autoArchiveManager.getSettings();
    }

    @Put('')
    @ApiOperation({
        summary: 'Update auto-archive settings',
        description: 'Selects independently for stats and replays which queues are saved when a match ends.',
    })
    @ApiBody({ type: AutoArchiveSettingsModel })
    @ApiOkResponse({ type: AutoArchiveSettingsModel })
    updateSettings(
        @Body(new ZodValidationPipe(AutoArchiveSettingsSchema)) settings: AutoArchiveSettings,
    ): AutoArchiveSettings {
        return this.autoArchiveManager.updateSettings(settings);
    }
}
