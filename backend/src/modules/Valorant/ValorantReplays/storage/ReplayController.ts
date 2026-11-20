import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Headers,
    HttpCode,
    HttpException,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBody,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiHeader,
    ApiPreconditionFailedResponse,
    ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { mapErrorAsync } from '@/utils/AsyncResultSwagger';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import {
    IllegalDownloadStateError,
    InvalidMatchIdError,
    InvalidReplayArchiveError,
    MatchAlreadyExistsError,
    MatchNotFoundError,
    UserMetadataVersionMismatchError,
} from '@/modules/Valorant/ValorantReplays/storage/ReplayStorageErrors';
import { parseIfMatch, toETag } from '@/modules/Valorant/ValorantReplays/storage/UserMetadataETag';
import {
    type DownloadStatesResponse,
    DownloadStatesResponseSchema,
    type ImportReplayQuery,
    ImportReplayQuerySchema,
    type MatchIdParam,
    MatchIdParamSchema,
    ReplayImportSchema,
    type ReplayListQuery,
    ReplayListQuerySchema,
    type ReplayListResponse,
    ReplayListResponseSchema,
    type ReplayMetadataV2,
    ReplayMetadataV2Schema,
    type StorageStatusDTO,
    StorageStatusDTOSchema,
    type UserMetadata,
    type UserMetadataPatch,
    UserMetadataPatchSchema,
    UserMetadataSchema,
} from '@vrv/shared';

class StorageStatusModel extends createZodDto(StorageStatusDTOSchema) {
}

class ReplayMetadataV2Model extends createZodDto(ReplayMetadataV2Schema) {
}

class ReplayListResponseModel extends createZodDto(ReplayListResponseSchema) {
}

class UserMetadataModel extends createZodDto(UserMetadataSchema) {
}

class UserMetadataPatchModel extends createZodDto(UserMetadataPatchSchema) {
}

class DownloadStatesResponseModel extends createZodDto(DownloadStatesResponseSchema) {
}

@Controller({
    path: 'plugins/replay/storage',
    version: '1',
})
export class ReplayController {
    constructor(protected readonly replayManager: ReplayManager) {
    }

    @Post('')
    @ApiOperation({
        summary: 'Initialize replay storage',
        description: 'Creates the replay storage folder.',
    })
    @ApiCreatedResponse({ description: 'Storage initialized successfully.' })
    @HttpCode(HttpStatus.CREATED)
    async setupStorage(): Promise<void> {
        await this.replayManager.setup();
    }

    @Delete('')
    @ApiOperation({
        summary: 'Delete replay storage',
        description: 'Deletes the replay storage folder recursively and clears the replay database.',
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse({ description: 'Storage deleted successfully.' })
    async teardownStorage(): Promise<void> {
        await this.replayManager.teardown();
    }

    @Get('status')
    @ApiOperation({ summary: 'Get storage status' })
    @ApiOkResponse({ type: StorageStatusModel })
    async getStorageStatus(): Promise<StorageStatusDTO> {
        return this.replayManager.getStatus();
    }

    @Get('matches')
    @ApiOperation({
        summary: 'List stored matches',
        description: 'Returns a page of stored matches, newest import first.',
    })
    @ApiOkResponse({ type: ReplayListResponseModel })
    async listStoredMatches(
        @Query(new ZodValidationPipe(ReplayListQuerySchema)) query: ReplayListQuery,
    ): Promise<ReplayListResponse> {
        return this.replayManager.listReplays(query);
    }

    @Get('download-states')
    @ApiOperation({
        summary: 'Get all download states',
        description: 'Returns the current download state for every known match, for initial hydration of the frontend store.',
    })
    @ApiOkResponse({ type: DownloadStatesResponseModel })
    async getDownloadStates(): Promise<DownloadStatesResponse> {
        return this.replayManager.getView() ?? {};
    }

    @Post('import')
    @ApiOperation({
        summary: 'Import a replay',
        description:
            'Imports a full replay package (.vrp), a raw replay file (.vrf), or a raw Riot match API response (.json). ' +
            'The `data` field must contain the JSON-encoded import request describing which of these `file` is.',
    })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 200 * 1024 * 1024 },
        }),
    )
    @ApiCreatedResponse({ type: ReplayMetadataV2Model })
    @ApiBadRequestResponse({ description: 'The uploaded file or import request is invalid.' })
    @ApiConflictResponse({ description: 'The match already exists or is currently downloading.' })
    async importReplay(
        @UploadedFile() file: Express.Multer.File,
        @Body('data') rawData: string,
        @Query(new ZodValidationPipe(ImportReplayQuerySchema)) query: ImportReplayQuery,
    ): Promise<ReplayMetadataV2> {
        if (!file?.buffer || file.buffer.length === 0) {
            throw new BadRequestException('No file uploaded');
        }

        let parsedData: unknown;
        try {
            parsedData = JSON.parse(rawData ?? '{}');
        } catch {
            throw new BadRequestException('Invalid JSON in `data` field');
        }

        const request = ReplayImportSchema.safeParse(parsedData);
        if (!request.success) {
            throw new BadRequestException(`Invalid import request: ${request.error.message}`);
        }

        return mapErrorAsync(
            this.replayManager.importReplay(file.buffer, request.data, query.override),
            new Map([
                [MatchAlreadyExistsError, (e) => new ConflictException(e.message)],
                [IllegalDownloadStateError, (e) => new ConflictException(e.message)],
                [InvalidReplayArchiveError, (e) => new BadRequestException(e.message)],
                [InvalidMatchIdError, (e) => new BadRequestException(e.message)],
            ]),
        );
    }

    @Get('matches/:matchId')
    @ApiOperation({
        summary: 'Download replay package',
        description: 'Returns the replay package (.vrp): a zip holding metadata.json (ReplayMetadataV2) and the replay file, if present.',
    })
    @ApiOkResponse({ description: 'Replay package.' })
    @ApiNotFoundResponse({ description: 'Match not found.' })
    async downloadReplayPackage(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const zip = await mapErrorAsync(
            this.replayManager.exportMatchToZip(matchId),
            new Map([[MatchNotFoundError, (e) => new NotFoundException(e.message)]]),
        );
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${matchId}.vrp"`,
        });
        return new StreamableFile(zip);
    }

    @Delete('matches/:matchId')
    @ApiOperation({
        summary: 'Delete stored match',
        description: 'Deletes the stored files and database entry of a match.',
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse({ description: 'Match deleted successfully.' })
    @ApiNotFoundResponse({ description: 'Match not found.' })
    async deleteStoredMatch(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
    ): Promise<void> {
        return mapErrorAsync(
            this.replayManager.deleteMatch(matchId),
            new Map([[MatchNotFoundError, (e) => new NotFoundException(e.message)]]),
        );
    }

    @Get('matches/:matchId/metadata')
    @ApiOperation({ summary: 'Get match metadata' })
    @ApiOkResponse({ type: ReplayMetadataV2Model })
    @ApiNotFoundResponse({ description: 'Match not found.' })
    async getMatchMetadata(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
    ): Promise<ReplayMetadataV2> {
        return mapErrorAsync(
            this.replayManager.getReplay(matchId),
            new Map([[MatchNotFoundError, (e) => new NotFoundException(e.message)]]),
        );
    }

    @Get('matches/:matchId/user-metadata')
    @ApiOperation({
        summary: 'Get user metadata',
        description: 'Returns the user-editable metadata of a match. The ETag header must be sent back as If-Match when patching.',
    })
    @ApiOkResponse({ type: UserMetadataModel })
    @ApiNotFoundResponse({ description: 'Match not found.' })
    async getUserMetadata(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
        @Res({ passthrough: true }) res: Response,
    ): Promise<UserMetadata> {
        const { userMetadata, version } = await mapErrorAsync(
            Promise.resolve(this.replayManager.getUserMetadata(matchId)),
            new Map([[MatchNotFoundError, (e) => new NotFoundException(e.message)]]),
        );
        res.set('ETag', toETag(version));
        return userMetadata;
    }

    @Patch('matches/:matchId/user-metadata')
    @ApiOperation({
        summary: 'Update user metadata',
        description: 'Partially updates name, notes and tags. Unknown tags are registered. Requires the ETag of the last read as If-Match.',
    })
    @ApiHeader({ name: 'If-Match', required: true, description: 'ETag from the last user-metadata read.' })
    @ApiBody({ type: UserMetadataPatchModel })
    @ApiOkResponse({ type: UserMetadataModel })
    @ApiNotFoundResponse({ description: 'Match not found.' })
    @ApiPreconditionFailedResponse({ description: 'The user metadata was modified since it was read.' })
    @ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED, description: 'If-Match header is missing.' })
    async patchUserMetadata(
        @Param(new ZodValidationPipe(MatchIdParamSchema)) { matchId }: MatchIdParam,
        @Headers('if-match') ifMatch: string | undefined,
        @Body(new ZodValidationPipe(UserMetadataPatchSchema)) patch: UserMetadataPatch,
        @Res({ passthrough: true }) res: Response,
    ): Promise<UserMetadata> {
        const acceptedVersions = parseIfMatch(ifMatch);
        if (acceptedVersions === null) {
            throw new HttpException('If-Match header is required', HttpStatus.PRECONDITION_REQUIRED);
        }
        if (acceptedVersions.length === 0) {
            throw new PreconditionFailedException('If-Match does not reference a known version');
        }

        const current = this.replayManager.getUserMetadata(matchId);
        const currentVersion = current.isSuccess() ? current.data.version : undefined;
        const expectedVersion = currentVersion !== undefined && acceptedVersions.includes(currentVersion)
            ? currentVersion
            : acceptedVersions[0];

        const { userMetadata, version } = await mapErrorAsync(
            Promise.resolve(this.replayManager.updateUserMetadata(matchId, expectedVersion, patch)),
            new Map<new (...args: any[]) => Error, (e: any) => Error>([
                [MatchNotFoundError, (e) => new NotFoundException(e.message)],
                [UserMetadataVersionMismatchError, (e) => new PreconditionFailedException(e.message)],
            ]),
        );
        res.set('ETag', toETag(version));
        return userMetadata;
    }
}
