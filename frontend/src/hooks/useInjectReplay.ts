import { useNavigate } from 'react-router-dom';
import { useProductSession, useShippingVersion, useStartInject } from '@/lib/queries';
import { checkCompatibility, VersionComparisonResult } from '@/lib/VersionUtils';
import type { ReplayMetadataV2 } from '@vrv/shared';

type DisabledInfo = {
    isDisabled: boolean;
    tooltip: string;
};

type GetDisabledInfoParams = {
    isInjecting: boolean;
    hasReplay: boolean;
    currentGameVersion: string | null;
    replayGameVersion: string | null;
    sessionAvailable: boolean;
};

const getDisabledInfo = ({
                             isInjecting,
                             hasReplay,
                             currentGameVersion,
                             replayGameVersion,
                             sessionAvailable,
                         }: GetDisabledInfoParams): DisabledInfo => {
    if (isInjecting) {
        return {
            isDisabled: true,
            tooltip: 'Injection in progress...',
        };
    }

    if (!hasReplay) {
        return {
            isDisabled: true,
            tooltip: 'No replay to playback'
        }
    }

    if (!sessionAvailable) {
        return {
            isDisabled: true,
            tooltip: 'No active game session found. Please start Valorant before injecting.',
        };
    }

    switch (checkCompatibility(currentGameVersion, replayGameVersion)) {
        case VersionComparisonResult.INCOMPATIBLE:
            return {
                isDisabled: true,
                tooltip: 'Replay game version is not compatible with current Valorant version',
            };

        case VersionComparisonResult.EXACT_MATCH:
            return {
                isDisabled: false,
                tooltip: 'Inject this replay into the game client',
            };

        case VersionComparisonResult.PROBABLY_COMPATIBLE:
            return {
                isDisabled: false,
                tooltip: 'Inject this replay into the game client.',
            };

        case VersionComparisonResult.UNKNOWN:
        default:
            return {
                isDisabled: false,
                tooltip: 'Unable to determine version compatibility.',
            };
    }
};

export const useInjectReplay = (replay: ReplayMetadataV2) => {
    const navigate = useNavigate();
    const { mutate: startInject, isPending: isInjecting } = useStartInject();
    const shippingVersion = useShippingVersion();
    const session = useProductSession('valorant');

    const disabledInfo = getDisabledInfo({
        isInjecting,
        hasReplay: !!replay?.replayFileMetadata,
        currentGameVersion: shippingVersion,
        replayGameVersion: replay?.riotMatchMetadata?.matchMetadata?.matchInfo?.gameVersion ?? null,
        sessionAvailable: !!session,
    });

    return {
        isInjecting,
        disabledInfo,
        inject: () =>
            startInject(replay.uuid, {
                onSuccess: () => navigate('/injector'),
            }),
    };
};