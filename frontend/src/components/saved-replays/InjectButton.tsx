import { Button } from '@/components/ui/button';
import { BugPlay, Loader2 } from 'lucide-react';
import { useInjectReplay } from '@/hooks/useInjectReplay';
import type { ReplayMetadataV2 } from '@vrv/shared';
import { InjectTooltip } from '@/components/saved-replays/InjectTooltip.tsx';

export type InjectButtonProps = {
    replay: ReplayMetadataV2;
};

export const InjectButton = ({ replay }: InjectButtonProps) => {
    const { inject, isInjecting, disabledInfo } = useInjectReplay(replay);

    return (
        <InjectTooltip tooltip={disabledInfo.tooltip}>
            <span>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={disabledInfo.isDisabled}
                    onClick={inject}
                >
                    {isInjecting ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <BugPlay />
                    )}
                </Button>
            </span>
        </InjectTooltip>
    );
};