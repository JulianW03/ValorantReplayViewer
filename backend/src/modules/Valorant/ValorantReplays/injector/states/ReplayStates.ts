import { LoggerService } from '@nestjs/common';
import { MachineContext, MarkerEvent, MarkerState } from '@/core/logic/StateMachine';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { ImportFlowIdSchema, InjectState, InjectStatus } from '@vrv/shared';

export { InjectState, type InjectStatus };

export interface ReplayDeps {
    readonly io: ReplayManager;
    readonly logger: LoggerService;
}

export type ReplayContext = ReplayDeps & MachineContext<ReplayEvent>;

export abstract class ReplayEvent implements MarkerEvent {
}

export abstract class ReplayState
    implements MarkerState<ReplayState, ReplayEvent, ReplayDeps> {
    public abstract readonly status: InjectState;
    public abstract transitionOn(event: ReplayEvent): ReplayState | undefined;
    public async onEnter(_ctx: ReplayContext): Promise<void> {
    }

    public get targetMatchId(): string | null {
        return null;
    }

    public get placeholderMatchId(): string | null {
        return null;
    }

    public describe(): InjectStatus {
        return {
            state: this.status,
            targetMatchId: this.targetMatchId,
            placeholderMatchId: this.placeholderMatchId,
        };
    }
}

export abstract class ActiveReplayState extends ReplayState {
    protected constructor(
        public readonly replayMatchId: string,
        public readonly replayInjectTarget: string,
    ) {
        super();
    }

    public override get targetMatchId(): string | null {
        return this.replayMatchId;
    }

    public override get placeholderMatchId(): string | null {
        return this.replayInjectTarget;
    }
}

export namespace ReplayEvents {
    export class CanceledEvent extends ReplayEvent {
    }

    export const Canceled = new CanceledEvent();

    export class InjectRequested extends ReplayEvent {
        constructor(
            public readonly replayMatchId: string,
            public readonly replayInjectTarget: string,
        ) {
            super();
        }
    }

    export class PlaceholderReady extends ReplayEvent {
        constructor(
            public readonly injectTargetId: string,
        ) {
            super();
        }
    }

    export class PlaceholderDownloadFailure extends ReplayEvent {
        constructor(
            public readonly injectTargetId: string,
            public readonly cause?: unknown,
        ) {
            super();
        }
    }

    export class ReplayEntered extends ReplayEvent {
    }

    export class MenusEntered extends ReplayEvent {
    }

    export class InjectSucceeded extends ReplayEvent {
    }

    export class InjectFailed extends ReplayEvent {
        constructor(public readonly cause?: unknown) {
            super();
        }
    }

    export class RestoreSucceeded extends ReplayEvent {
    }

    export class RestoreFailed extends ReplayEvent {
        constructor(public readonly cause?: unknown) {
            super();
        }
    }

    export class Failed extends ReplayEvent {
        constructor(
            public readonly stage: string,
            public readonly cause?: unknown,
        ) {
            super();
        }
    }
}

export namespace ReplayStates {
    export class IdleState extends ReplayState {
        public readonly status = InjectState.IDLE;

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.InjectRequested) {
                return new DownloadingInjectTarget(
                    event.replayMatchId,
                    event.replayInjectTarget,
                );
            }
            return undefined;
        }
    }

    export const Idle = new IdleState();

    export class ErrorState extends ReplayState {
        public readonly status = InjectState.FAILED;

        constructor(
            public readonly stage: string,
            public readonly cause?: unknown,
        ) {
            super();
        }

        async onEnter(ctx: ReplayContext): Promise<void> {
            ctx.logger.error?.(`Replay inject failed during ${this.stage}`, this.cause);
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.CanceledEvent) {
                return Idle;
            }
            return undefined;
        }
    }

    export class DownloadingInjectTarget extends ActiveReplayState {
        public readonly status = InjectState.DOWNLOADING_PLACEHOLDER;

        constructor(replayMatchId: string, replayInjectTarget: string) {
            super(replayMatchId, replayInjectTarget);
        }

        async onEnter(ctx: ReplayContext): Promise<void> {
            try {
                await ctx.io.triggerDownload(this.replayInjectTarget, ImportFlowIdSchema.enum.INJECTION_PLACEHOLDER, true);
                if (ctx.signal.aborted) return;

                await ctx.io.moveToValorantDemos(this.replayInjectTarget);
                ctx.dispatch(new ReplayEvents.PlaceholderReady(this.replayInjectTarget));
            } catch (e) {
                ctx.dispatch(
                    new ReplayEvents.PlaceholderDownloadFailure(this.replayInjectTarget, e),
                );
            }
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.CanceledEvent) {
                return Idle;
            }
            if (event instanceof ReplayEvents.PlaceholderReady) {
                return new AwaitingReplayStart(
                    this.replayMatchId,
                    this.replayInjectTarget,
                );
            }
            if (event instanceof ReplayEvents.PlaceholderDownloadFailure) {
                return new ErrorState('placeholder download', event.cause);
            }
            if (event instanceof ReplayEvents.Failed) {
                return new ErrorState(event.stage, event.cause);
            }
            return undefined;
        }
    }

    export class AwaitingReplayStart extends ActiveReplayState {
        public readonly status = InjectState.AWAITING_REPLAY_START;

        constructor(replayMatchId: string, replayInjectTarget: string) {
            super(replayMatchId, replayInjectTarget);
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.CanceledEvent) {
                return Idle;
            }
            if (event instanceof ReplayEvents.ReplayEntered) {
                return new SwappingFiles(this.replayMatchId, this.replayInjectTarget);
            }
            if (event instanceof ReplayEvents.Failed) {
                return new ErrorState(event.stage, event.cause);
            }
            return undefined;
        }
    }

    export class SwappingFiles extends ActiveReplayState {
        public readonly status = InjectState.AWAITING_REPLAY_START;

        constructor(replayMatchId: string, replayInjectTarget: string) {
            super(replayMatchId, replayInjectTarget);
        }

        async onEnter(ctx: ReplayContext): Promise<void> {
            try {
                await ctx.io.injectReplayOverPlaceholder(
                    this.replayMatchId,
                    this.replayInjectTarget,
                );
                ctx.dispatch(new ReplayEvents.InjectSucceeded());
            } catch (e) {
                ctx.dispatch(new ReplayEvents.InjectFailed(e));
            }
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.InjectSucceeded) {
                return new Injected(this.replayMatchId, this.replayInjectTarget);
            }
            if (event instanceof ReplayEvents.InjectFailed) {
                // Nothing was swapped, so no restore is owed.
                return new ErrorState('file swap', event.cause);
            }
            if (event instanceof ReplayEvents.Failed) {
                return new ErrorState(event.stage, event.cause);
            }
            return undefined;
        }
    }

    export class Injected extends ActiveReplayState {
        public readonly status = InjectState.INJECTED;

        constructor(replayMatchId: string, replayInjectTarget: string) {
            super(replayMatchId, replayInjectTarget);
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            // The placeholder file is overwritten on disk right now, so every
            // exit from this state has to go through the restore.
            if (
                event instanceof ReplayEvents.MenusEntered
            ) {
                return new RestoringOriginal(
                    this.replayMatchId,
                    this.replayInjectTarget,
                );
            }
            if (event instanceof ReplayEvents.Failed) {
                return new ErrorState(event.stage, event.cause);
            }
            return undefined;
        }
    }

    export class RestoringOriginal extends ActiveReplayState {
        public readonly status = InjectState.RESTORING_ORIGINAL_REPLAY;

        constructor(replayMatchId: string, replayInjectTarget: string) {
            super(replayMatchId, replayInjectTarget);
        }

        async onEnter(ctx: ReplayContext): Promise<void> {
            try {
                await ctx.io.restoreReplayFile(this.replayInjectTarget);
                ctx.dispatch(new ReplayEvents.RestoreSucceeded());
            } catch (e) {
                ctx.dispatch(new ReplayEvents.RestoreFailed(e));
            }
        }

        transitionOn(event: ReplayEvent): ReplayState | undefined {
            if (event instanceof ReplayEvents.RestoreSucceeded) {
                return Idle;
            }
            if (event instanceof ReplayEvents.RestoreFailed) {
                return new ErrorState('restore', event.cause);
            }
            if (event instanceof ReplayEvents.Failed) {
                return new ErrorState(event.stage, event.cause);
            }
            return undefined;
        }
    }
}