import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { RiotValorantAPIManager } from '@/integrations/riot/RiotValorantAPIManager';
import { EntitlementTokenManager } from '@/modules/EntitlementTokenModule/EntitlementTokenManager';
import { PuuidToPlayerAliasManager } from '@/modules/PuuidToPlayerAliasModule/PuuidToPlayerAliasManager';
import {
    CURRENT_REPLAY_FORMAT_VERSION,
    GUID,
    PlayerAliasDTO,
    ReplayMetadataV2,
    RiotMatchApiResponseDTO,
    RiotMatchMetadata,
} from '@vrv/shared';
import { createHash } from 'node:crypto';
import { ReplaySummary } from '@/integrations/riot/ValorantApiSpec';

export type FetchedMatchMetadata = ReplayMetadataV2 & { riotMatchMetadata: RiotMatchMetadata };

interface ReplayData {
    buffer: Buffer;
    summary: ReplaySummary;
}

@Injectable()
export class ReplayFetchManager {
    private readonly logger = new Logger(ReplayFetchManager.name);

    constructor(
        private readonly apiClient: RiotValorantAPIManager,
        private readonly tokenManager: EntitlementTokenManager,
        private readonly puuidManager: PuuidToPlayerAliasManager,
    ) {
    }

    public async fetchMatchMetadata(matchId: string): Promise<FetchedMatchMetadata> {
        return this.toMetadata(await this.apiClient.matches.getDetails(matchId));
    }

    public async fetchReplayFile(matchId: string): Promise<Buffer> {
        return (await this.getReplayData(matchId)).buffer;
    }

    private async toMetadata(matchDetails: RiotMatchApiResponseDTO): Promise<FetchedMatchMetadata> {
        const puuidResolver = await this.getPuuidResolverMap(matchDetails);
        const currentId = this.tokenManager.getView()?.subject;

        return buildMetadata(matchDetails, puuidResolver, currentId);
    }

    private async getReplayData(matchId: string): Promise<ReplayData> {
        const [replayBuffer, replaySummary] = await Promise.all([
            this.apiClient.replays.downloadFile(matchId),
            this.apiClient.replays.getSummary(matchId),
        ]);

        const hash = createHash('sha256')
            .update(replayBuffer)
            .digest('hex');

        if (hash !== replaySummary.Checksum) {
            throw new Error(
                `Replay file checksum mismatch for match with Id ${matchId}. Expected ${replaySummary.Checksum}, got ${hash}`,
            );
        }

        return { buffer: replayBuffer, summary: replaySummary };
    }

    private async getPuuidResolverMap(matchDetails: RiotMatchApiResponseDTO): Promise<Record<GUID, PlayerAliasDTO>> {
        const puuids = matchDetails.players
            .map((p) => p.subject)
            .filter((p) => p !== undefined);

        const puuidResolver = {} as Record<GUID, PlayerAliasDTO>;
        try {
            this.puuidManager.requestBatchFetch(puuids);
            const resolveMap = await this.puuidManager.getBestEffortBatchedResult(puuids, 5_000);

            this.logger.debug('Resolved player aliases for replay metadata.', resolveMap);

            for (const matchDetail of matchDetails?.players ?? []) {
                const subject = matchDetail.subject;
                if (!subject) continue;

                const resolvedAlias = resolveMap[subject];
                if (resolvedAlias) {
                    puuidResolver[subject] = resolvedAlias;
                }
            }
        } catch (error) {
            this.logger.warn(
                'Failed to resolve player aliases for replay metadata. Proceeding with unresolved puuids.',
                error,
            );
        }

        return puuidResolver;
    }
}

export function buildMetadata(
    matchDetails: RiotMatchApiResponseDTO,
    puuidResolver: Record<GUID, PlayerAliasDTO>,
    subject: string | undefined,
): FetchedMatchMetadata {

    const concatId = matchDetails.matchInfo.matchId.substring(0, 8);


    const obj: FetchedMatchMetadata = {
        formatVersion: CURRENT_REPLAY_FORMAT_VERSION,
        uuid: matchDetails.matchInfo.matchId,
        riotMatchMetadata: {
            matchMetadata: matchDetails,
            puuidResolver: puuidResolver,
        },
        userMetadata: {
            name: `Replay ${concatId}`,
            tags: [],
            notes: null,
        },
    };

    if (subject) {
        obj.downloaderMetadata = {
            downloadedAt: Date.now(),
            downloaderId: subject,
        };

        const resolvedTagline = puuidResolver?.[subject];
        if (resolvedTagline) {
            obj.userMetadata!.name = `${resolvedTagline.gameName}#${resolvedTagline.tagLine}'s Replay ${concatId}`;
        }
    }


    return obj;
}
