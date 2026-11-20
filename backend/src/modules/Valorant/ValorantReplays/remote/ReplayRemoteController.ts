import {
    NotFoundException,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { ProductSessionGuard, RequiredProduct } from '@/modules/ProductSessionModule/ProductSessionGuard';
import {
    type DownloadStateDTO,
    DownloadStateDTOSchema,
    ImportFlowIdSchema,
    type MatchIdParam,
    MatchIdParamSchema,
} from '@vrv/shared';

class DownloadStateModel extends createZodDto(DownloadStateDTOSchema) {
}

@RequiredProduct('valorant')
@UseGuards(ProductSessionGuard)
@Controller({
    path: 'plugins/replay/remote',
})
export class ReplayRemoteController {
    private readonly logger = new Logger(ReplayRemoteController.name);

    constructor(
        protected readonly replayManager: ReplayManager,
    ) {
    }

    @Post('matches/recent/:matchId/download')
    @ApiOperation({
        summary: 'Trigger replay download',
        description: 'Starts downloading replay data for a given match.',
    })
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiAcceptedResponse({
        description: 'Download triggered.',
    })
    triggerDownload(@Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam): void {
        this.startDownload(matchId, false);
    }

    @Post('matches/recent/:matchId/download/retry')
    @ApiOperation({
        summary: 'Retry replay download',
        description: 'Retries a failed replay download for a given match.',
    })
    @HttpCode(HttpStatus.ACCEPTED)
    retryDownload(@Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam): void {
        this.startDownload(matchId, true);
    }

    @Get('matches/recent/:matchId/download/state')
    @ApiOperation({
        summary: 'Get download state',
        description: 'Returns current status of a replay download job.',
    })
    @ApiOkResponse({ type: DownloadStateModel })
    @ApiNotFoundResponse({ description: 'No download known for this match.' })
    getDownloadState(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
    ): DownloadStateDTO {
        const entryView = this.replayManager.getKeyView(matchId);
        if (entryView === null) {
            throw new NotFoundException(`No download job found for match ${matchId}`);
        }
        return entryView;
    }

    private startDownload(matchId: string, retry: boolean): void {
        this.replayManager.triggerDownload(matchId, ImportFlowIdSchema.enum.MANUAL_DOWNLOAD, retry).catch((e) => {
            this.logger.warn(`Download of match ${matchId} did not complete`, e);
        });
    }
}
