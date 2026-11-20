import { Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ReplayInjectManagerV2 } from '@/modules/Valorant/ValorantReplays/injector/ReplayInjectManagerV2';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { type InjectStatus, InjectStatusSchema, type MatchIdParam, MatchIdParamSchema } from '@vrv/shared';

class InjectStatusModel extends createZodDto(InjectStatusSchema) {
}

@Controller({
    path: 'plugins/replay/injector',
    version: '1',
})
export class ReplayInjectController {
    private readonly logger = new Logger(ReplayInjectController.name);

    constructor(
        protected readonly replayManager: ReplayManager,
        protected readonly replayInjectManager: ReplayInjectManagerV2,
    ) {
    }

    @Post('matches/:matchId')
    @ApiOperation({
        summary: 'Start injection',
        description: 'Starts replay injection for a stored match.',
    })
    @HttpCode(HttpStatus.ACCEPTED)
    async startInject(@Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam): Promise<void> {
        if (!this.replayManager.matchRegistered(matchId)) {
            throw new NotFoundException(
                `Match ${matchId} not found in storage`,
            );
        }
        this.replayInjectManager.startInject(matchId).catch((err) => {
            this.logger.warn('Error occured', err);
        });
    }

    @Get('status')
    @ApiOperation({
        summary: 'Get injector status',
        description: 'Returns current replay injection status.',
    })
    @ApiOkResponse({ type: InjectStatusModel })
    getInjectStatus(): InjectStatus {
        const status = this.replayInjectManager.getView();
        if (!status) {
            throw new NotFoundException();
        }
        return status;
    }

    @Delete('')
    @ApiOperation({
        summary: 'Cancel injection',
        description: 'Stops any running replay injection process.',
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    cancelInject(): void {
        this.replayInjectManager.cancelInject();
    }
}
