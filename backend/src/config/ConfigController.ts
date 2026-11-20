import {
    Body,
    Controller,
    Delete,
    Get,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    Post,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
} from '@nestjs/swagger';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { type AppVersion, AppVersionSchema } from '@vrv/shared';
import {
    type EnvConfigV1DTO,
    type OverridableConfigV1,
    OverridableConfigV1Schema,
} from '@/config/ConfigV1.schema';
import { ConfigLoader, InjectAppVersion } from '@/config/configLoader';

const isNotFound = (e: unknown): boolean =>
    (e as NodeJS.ErrnoException)?.code === 'ENOENT';

class AppVersionModel extends createZodDto(AppVersionSchema) {
}

@Controller({
    path: 'configuration',
    version: '1',
})
export class ConfigController {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private readonly loader: ConfigLoader,
        @InjectAppVersion() private readonly appVersion: AppVersion,
    ) {
    }

    @ApiOperation({
        summary: 'Read the app version',
        description: 'Resolved once at startup. Not affected by configuration overrides.',
    })
    @Get('version')
    @ApiOkResponse({ type: AppVersionModel })
    public getAppVersion(): AppVersion {
        return this.appVersion;
    }

    @ApiOperation({
        summary: 'Check if a provided configuration override is valid',
        description:
            'Can be used to validate an override payload before saving it. This does not change the current configuration.',
    })
    @Post('validate')
    @ApiBadRequestResponse({
        description: 'Invalid configuration',
    })
    @ApiOkResponse({
        description: 'The overrides that would be saved.',
    })
    public validateConfig(
        @Body(new ZodValidationPipe(OverridableConfigV1Schema)) config: OverridableConfigV1,
    ): OverridableConfigV1 {
        return config;
    }

    @ApiOperation({
        summary: 'Delete all configuration overrides',
        description: 'Restores the shipped default configuration.',
    })
    @Delete('overrides')
    public async restoreDefaultConfiguration(): Promise<void> {
        try {
            await unlink(this.loader.getConfigOverridesPath());
        } catch (e) {
            if (!isNotFound(e)) {
                this.logger.error('Failed to delete config overrides file', e);
                throw new InternalServerErrorException('Failed to delete config overrides file');
            }
        } finally {
            this.loader.invalidate();
        }
    }

    @ApiOperation({
        summary: 'Persist configuration overrides',
    })
    @Post('overrides')
    @ApiBadRequestResponse({
        description: 'Invalid configuration',
    })
    @ApiOkResponse({
        description: 'The persisted overrides.',
    })
    public async updateCurrentConfiguration(
        @Body(new ZodValidationPipe(OverridableConfigV1Schema)) config: OverridableConfigV1,
    ): Promise<OverridableConfigV1> {
        try {
            await mkdir(this.loader.getPersistentPath(), { recursive: true });
            await writeFile(
                this.loader.getConfigOverridesPath(),
                JSON.stringify(config, null, 2),
                'utf8',
            );
            this.loader.invalidate();
            return config;
        } catch (e) {
            this.logger.error('Failed to write config overrides file', e);
            throw new InternalServerErrorException('Failed to write config overrides file');
        }
    }

    @ApiOperation({
        summary: 'Read the currently persisted configuration overrides',
    })
    @Get('overrides')
    @ApiNotFoundResponse({
        description: 'No configuration overrides found',
    })
    public async readCurrentConfiguration(): Promise<OverridableConfigV1> {
        const overrides = await this.loader.getConfigOverrides();

        if (Object.keys(overrides).length === 0) {
            throw new NotFoundException('No configuration overrides found');
        }

        return overrides;
    }

    @ApiOperation({
        summary: 'Read the effective configuration',
        description: 'Base configuration merged with any persisted overrides.',
    })
    @Get('current')
    public getEffectiveConfiguration(): Promise<EnvConfigV1DTO> {
        return this.loader.getEffectiveConfig();
    }
}
