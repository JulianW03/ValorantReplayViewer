import React from 'react';
import { formatClock } from '@/lib/utils.ts';
import { useAgentRegistry } from '@/lib/queries.ts';
import { TWO_TEAM_ROLE_IDS, type TWO_TEAMS_ROLE_ID } from '@vrv/shared';
import { resolve } from '@/lib/LocalLinkResolver.ts';

export interface TimelineKill {
    roundTimeMs: number;
    killerSide: TWO_TEAMS_ROLE_ID;
    killerId: string;
    killerAgentId: string;
    weaponIconUrl: string | undefined;
}

export interface RoundTimelineData {
    roundNum: number;
    durationMs: number;
    kills: TimelineKill[];
    plant?: { roundTimeMs: number };
    defuse?: { roundTimeMs: number };
}

export interface RoundTimelineProps {
    data: RoundTimelineData;
    highlightPlayer?: string;
    height?: number;
}

const COLORS = {
    ATTACKER: '#FF0000',
    DEFENDER: '#00F0F0',
};

const TIMELINE_RESULUTION_MS = 10_000;
const DIVERGE_INDEX = 3.0;


export function RoundTimeline({ data, height = 250 }: RoundTimelineProps) {
    const agents = useAgentRegistry();
    const mid = height / 2 - 2;
    const dur = data.durationMs || 1;
    const pct = (t: number) => `${(t / dur) * 100}%`;

    const lanes: Record<string, { pos: number; lane: number }[]> = { attacker: [], defender: [] };
    const placed = data.kills.map((k) => {
        const posRel = (k.roundTimeMs / dur) * 100;
        const arr = lanes[k.killerSide.toLowerCase()];
        let lane = 0;
        while (arr.some((p) => p.lane === lane && Math.abs(p.pos - posRel) < DIVERGE_INDEX)) lane++;
        arr.push({ pos: posRel, lane });
        return { k, L: posRel, lane };
    });

    const ticks: number[] = [];
    for (let t = 0; t <= dur; t += TIMELINE_RESULUTION_MS) ticks.push(t);

    return (
        <div className={'rounded-lg mb-4'} style={{
            padding: '16px 22px 14px',
        }}>
            <div className={'flex items-center justify-between mb-2'}>
                <div className={'text-xs tracking-wide font-semibold text-[#5d6b78]'}>
                    ROUND TIMELINE
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height }}>
                {/* base line */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: mid,
                    height: 2,
                    background: 'linear-gradient(90deg,rgba(52,72,90,0),#fafafa2f 6%,#fafafa2f 94%,rgba(52,72,90,0))',
                }} />

                {/* ticks */}
                {ticks.map((t) => {
                    const L = (t / dur) * 100;
                    return (
                        <React.Fragment key={t}>
                            <div className={'absolute bg-[#fafafa2f] -translate-x-1/2 h-3 w-[1px]'} style={{
                                left: `${L}%`,
                                top: mid - 5,
                            }} />
                            <div className={'absolute text-[#fafafa2f] -translate-x-1/2 text-xs'} style={{
                                left: `${L}%`,
                                top: mid + 11,
                            }}>{formatClock(t)}</div>
                        </React.Fragment>
                    );
                })}

                {/* kills */}
                {placed.map(({ k, lane }, i) => {
                    const off = 40 + lane * 40;
                    const iconTop = k.killerSide === TWO_TEAM_ROLE_IDS.ATTACKER ? mid - off : mid + off;
                    const col = k.killerSide === TWO_TEAM_ROLE_IDS.ATTACKER ? COLORS.ATTACKER : COLORS.DEFENDER;
                    const connTop = Math.min(mid, iconTop);
                    const connH = Math.abs(iconTop - mid);
                    return (
                        <React.Fragment key={i}>
                            <div className={'absolute w-[2px] opacity-33 -translate-x-1/2'} style={{
                                position: 'absolute',
                                left: pct(k.roundTimeMs),
                                top: connTop,
                                height: connH,
                                background: col,
                            }} />
                            <div
                                className={'absolute w-[34px] h-[34px] rounded-full -translate-1/2 flex items-center justify-center overflow-hidden '}
                                style={{
                                    left: pct(k.roundTimeMs),
                                    top: iconTop,
                                    border: `2px solid ${col}`,
                                    zIndex: 3,
                                }}>
                                <img src={agents?.[k.killerAgentId]?.displayIconSmall!} alt=""
                                     className={'w-[32px] h-[32px] object-cover'} />
                            </div>
                        </React.Fragment>
                    );
                })}

                {/* plant */}
                {data.plant && (
                    <>
                        <div className={'absolute w-5 h-5 z-[6] -translate-1/2'}
                             style={{
                                 left: pct(data.plant.roundTimeMs),
                                 top: mid,
                                 backgroundColor: COLORS.ATTACKER,
                                 WebkitMaskImage: `url(${resolve("/api/v1/assets/proxy?url=https%3A%2F%2Fmedia.valorant-api.com%2Fgamemodes%2F96bd3920-4f36-d026-2b28-c683eb0bcac5%2Fdisplayicon.png", "http")})`,
                                 maskImage: `url(${resolve("/api/v1/assets/proxy?url=https%3A%2F%2Fmedia.valorant-api.com%2Fgamemodes%2F96bd3920-4f36-d026-2b28-c683eb0bcac5%2Fdisplayicon.png", "http")})`,
                                 WebkitMaskRepeat: 'no-repeat',
                                 maskRepeat: 'no-repeat',
                                 WebkitMaskPosition: 'center',
                                 maskPosition: 'center',
                                 WebkitMaskSize: 'cover',
                                 maskSize: 'cover',
                             }}>
                        </div>
                        {/*<div style={{ position: "absolute", left: pct(data.plant.roundTimeMs), top: mid - 26, transform: "translateX(-50%)", fontSize: 9, letterSpacing: 1, color: palette.spike, fontWeight: 700, whiteSpace: "nowrap" }}>PLANT {formatClock(data.plant.roundTimeMs)}</div>*/}
                    </>
                )}

                {/* defuse */}
                {data.defuse && (
                    <>
                        <div className={'absolute w-5 h-5 z-[6] -translate-1/2'}
                             style={{
                                 left: pct(data.defuse.roundTimeMs),
                                 top: mid,
                                 backgroundColor: COLORS.DEFENDER,
                                 WebkitMaskImage: `url(${resolve("/api/v1/assets/proxy?url=https%3A%2F%2Fmedia.valorant-api.com%2Fgamemodes%2F96bd3920-4f36-d026-2b28-c683eb0bcac5%2Fdisplayicon.png", "http")})`,
                                 maskImage: `url(${resolve("/api/v1/assets/proxy?url=https%3A%2F%2Fmedia.valorant-api.com%2Fgamemodes%2F96bd3920-4f36-d026-2b28-c683eb0bcac5%2Fdisplayicon.png", "http")})`,
                                 WebkitMaskRepeat: 'no-repeat',
                                 maskRepeat: 'no-repeat',
                                 WebkitMaskPosition: 'center',
                                 maskPosition: 'center',
                                 WebkitMaskSize: 'cover',
                                 maskSize: 'cover',
                             }}>
                        </div>
                        {/*<div style={{ position: "absolute", left: pct(data.defuse.roundTimeMs), top: mid - 26, transform: "translateX(-50%)", fontSize: 9, letterSpacing: 1, color: COLORS.DEFENDER, fontWeight: 700, whiteSpace: "nowrap" }}>DEFUSE {formatClock(data.defuse.roundTimeMs)}</div>*/}
                    </>
                )}
            </div>
        </div>
    );
}
