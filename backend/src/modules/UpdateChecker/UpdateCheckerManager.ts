import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type AppConfig, InjectConfig } from '@/config/configLoader';
import z from 'zod';
import semver from 'semver';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { SimpleObjectDataManager } from '@/core/data/SimpleObjectDataManager';
import { EmittingObjectDataBehavior } from '@/core/data/behaviors/emission/EmittingObjectDataBehavior';
import { IObjectDataManager } from '@/core/data/interfaces/IObjectDataManager';
import {
    UnknownStatusReason,
    UpdateInfo,
    UpdateStatus,
    UpdateStatusIndicator,
} from '#/schemas/updateCheck/UpdateStatus.schema';

const MinimalGithubReleaseAssetSchema = z.object({
    'name': z.string(),
    'digest': z.string(),
    'browser_download_url': z.url(),
});

const MinimalGithubReleaseInfoSchema = z.object({
    'html_url': z.url(),
    'tag_name': z.string(),
    'published_at': z.iso.datetime(),
    'assets': z.array(MinimalGithubReleaseAssetSchema),
    'body': z.string()
});

@Injectable()
export class UpdateCheckerManager implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(UpdateCheckerManager.name);

    private controller: AbortController | null = null;
    private interval: NodeJS.Timeout | null = null;
    private manager: IObjectDataManager<UpdateStatus, UpdateStatus>;
    private readonly repoUrl: string;
    private readonly latestReleaseUrl: string;

    public constructor(
        @InjectConfig()
        protected readonly config: AppConfig,
        private readonly eventBus: SimpleEventBus,
    ) {
        const user = encodeURIComponent(config.configurations['update-check']['github-user']);
        const repo = encodeURIComponent(config.configurations['update-check']['github-repo']);
        this.repoUrl = `https://github.com/${user}/${repo}`;
        this.latestReleaseUrl = `https://api.github.com/repos/${user}/${repo}/releases/latest`;

        const base = new SimpleObjectDataManager<UpdateStatus>({
            status: UpdateStatusIndicator.enum.UNKNOWN,
            reason: UnknownStatusReason.enum.NO_FETCH_YET,
            last_check_timestamp: null,
            repo_url: this.repoUrl,
        });
        this.manager = new EmittingObjectDataBehavior(base, eventBus, 'UpdateCheckerManager');
    }

    public onModuleInit(): any {
        this.controller = new AbortController();
        this.interval = setInterval(
            this.refreshState.bind(this),
            this.config.configurations['update-check']['check-interval-seconds'] * 1_000,
        );
        this.refreshState().catch((err) => {});
    }


    private async refreshState(): Promise<void> {
        this.logger.debug('Refreshing update state');
        const last_check_timestamp = new Date().toISOString();
        const rawJson = await fetch(this.latestReleaseUrl, {
            signal: AbortSignal.any([(this.controller?.signal ?? AbortSignal.abort()), AbortSignal.timeout(5_000)]),
        }).then(res => res.json()).catch(err => {
            this.logger.error(err.message);
        });
        if (!rawJson) {
            this.logger.warn('Failed to fetch update information');
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UNKNOWN,
                reason: UnknownStatusReason.enum.REMOTE_FETCH_FAILED,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
            });
            return;
        }

        const validated = await MinimalGithubReleaseInfoSchema.parseAsync(rawJson).catch(err => {
            this.logger.log(err.message);
        });
        if (!validated) {
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UNKNOWN,
                reason: UnknownStatusReason.enum.REMOTE_SCHEMA_INVALID,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
            });
            return;
        }
        this.logger.debug('Fetched latest release information', validated);
        const latestVersionTag = validated.tag_name;
        const latestVersion = semver.clean(latestVersionTag);
        const currentVersion = semver.clean(this.config.version.app);
        //TODO: When current version cannot be determined we should probably prompt for an update.
        if (!latestVersion) {
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UNKNOWN,
                reason: UnknownStatusReason.enum.REMOTE_SCHEMA_INVALID,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
            });
            return;
        }
        if (!currentVersion) {
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UNKNOWN,
                reason: UnknownStatusReason.enum.VERSION_PARSE_FAILED,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
            });
            return;
        }

        if (!semver.gt(latestVersion, currentVersion)) {
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UP_TO_DATE,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
            });
            return;
        }

        const optAsset = validated.assets.find((asset) => asset.name?.startsWith('ValorantReplayViewer'));
        if (!optAsset) {
            this.manager.updateValue({
                status: UpdateStatusIndicator.enum.UNKNOWN,
                last_check_timestamp: last_check_timestamp,
                repo_url: this.repoUrl,
                reason: UnknownStatusReason.enum.REMOTE_SCHEMA_INVALID
            });
            return;
        }

        const updateInfo: UpdateInfo = {
            version: latestVersion,
            release_notes: validated.body,
            download_url: optAsset.browser_download_url
        }


        this.manager.updateValue({
            status: UpdateStatusIndicator.enum.UPDATE_AVAILABLE,
            last_check_timestamp: last_check_timestamp,
            repo_url: this.repoUrl,
            update_info: updateInfo
        })
    }

    public onModuleDestroy(): void {
        this.interval && clearInterval(this.interval);
        this.controller?.abort();
    }

    public getView(): UpdateStatus | null {
        return this.manager.getView()
    }
}