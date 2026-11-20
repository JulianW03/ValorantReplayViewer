import { formatCredits } from '@/lib/utils.ts';
import { useAgentRegistry, useGearRegistry, useWeaponRegistry } from '@/lib/queries.ts';
import { type GUID, TWO_TEAM_ROLE_IDS, type TWO_TEAMS_ROLE_ID } from '@vrv/shared';

export interface EconomyPlayerRow {
    subject: GUID;
    agentId: GUID;
    gameName: string;
    tagLine: string;
    weaponId: GUID;
    armorId: GUID;
    remaining: number;
    moneySpend: number;
    loadoutValue: number;
}

export interface RoundEconomyData {
    roundNum: number;
    attackers: EconomyPlayerRow[];
    defenders: EconomyPlayerRow[];
    attackerTotal: number;
    defenderTotal: number;
}

export interface RoundEconomyOverviewProps {
    data: RoundEconomyData;
    highlightPlayer?: GUID;
}

const ROLE_ACCENT: Record<TWO_TEAMS_ROLE_ID, string> = {
    [TWO_TEAM_ROLE_IDS.ATTACKER]: '#FF4655',
    [TWO_TEAM_ROLE_IDS.DEFENDER]: '#1FD8B4',
};

function EconomyRow({ row, accent, highlighted }: { row: EconomyPlayerRow; accent: string; highlighted: boolean }) {
    const agent = useAgentRegistry()?.[row.agentId];
    const weapon = useWeaponRegistry()?.[row.weaponId?.toLowerCase()];
    const armor = useGearRegistry()?.[row.armorId?.toLowerCase()];

    return (
        <div
            className="flex items-center gap-3 py-2 pl-2 -ml-2 rounded border-b border-[rgba(255,255,255,0.04)] last:border-b-0"
            style={highlighted ? { background: `${accent}1a`, boxShadow: `inset 2px 0 0 ${accent}` } : undefined}
        >
            <img
                src={agent?.displayIconSmall ?? undefined}
                alt={row.gameName}
                className="w-8 h-8 rounded-full bg-[#0A1119] shrink-0 object-cover"
            />
            <div className="w-32 min-w-0 shrink-0">
                <div
                    className={`text-xs truncate ${highlighted ? 'font-semibold text-[#ECE8E1]' : 'font-medium'}`}>{row.gameName}</div>
            </div>
            <img
                src={weapon?.displayIcon ?? undefined}
                alt={weapon?.displayName ?? 'Melee'}
                title={weapon?.displayName ?? 'Melee'}
                className="h-4 w-16 object-contain brightness-150 shrink-0"
            />
            {armor ? (
                <img
                    src={armor.displayIcon}
                    alt={armor.displayName}
                    title={armor.displayName}
                    className="w-5 h-5 object-contain shrink-0"
                />
            ) : (
                <span
                    className="w-5 h-5 shrink-0 flex items-center justify-center text-[10px] text-[#3a4753]"
                    title="No Armor"
                >
                    —
                </span>
            )}
            <span
                className="ml-auto text-sm font-medium tabular-nums shrink-0 mr-4">
                {formatCredits(row.moneySpend)}
                <span className={'text-[#3a4753]'}>
                    <span className={'mx-1'}>/</span>
                    {formatCredits(row.remaining + row.moneySpend)}
                </span>
            </span>
        </div>
    );
}

function BuyBalanceBar({ attackerTotal, defenderTotal }: { attackerTotal: number; defenderTotal: number }) {
    const max = Math.max(attackerTotal, defenderTotal, 1);
    const attackerPct = (attackerTotal / max) * 100;
    const defenderPct = (defenderTotal / max) * 100;

    return (
        <div className="flex items-center gap-3 mb-4">
            <span className="w-14 shrink-0 text-right text-[10px] font-semibold tabular-nums text-[#ECE8E1]">
                {formatCredits(attackerTotal)}
            </span>
            <div className="flex flex-1 items-center">
                <div className="flex flex-1 justify-end">
                    <div
                        className="h-2 rounded-l-sm transition-[width] duration-300"
                        style={{ width: `${attackerPct}%`, background: ROLE_ACCENT[TWO_TEAM_ROLE_IDS.ATTACKER] }}
                    />
                </div>
                <div className="w-px h-4 shrink-0 bg-white/15" />
                <div className="flex flex-1 justify-start">
                    <div
                        className="h-2 rounded-r-sm transition-[width] duration-300"
                        style={{ width: `${defenderPct}%`, background: ROLE_ACCENT[TWO_TEAM_ROLE_IDS.DEFENDER] }}
                    />
                </div>
            </div>
            <span className="w-14 shrink-0 text-[10px] font-semibold tabular-nums text-[#ECE8E1]">
                {formatCredits(defenderTotal)}
            </span>
        </div>
    );
}

function EconomyColumn({
                           title,
                           accent,
                           rows,
                           highlightPlayer,
                       }: {
    title: string;
    accent: string;
    rows: EconomyPlayerRow[];
    total: number;
    highlightPlayer?: GUID;
}) {
    return (
        <div>
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[rgba(255,255,255,0.06)]">
                <span className="text-xs font-semibold tracking-[0.15em]" style={{ color: accent }}>{title}</span>
            </div>
            {rows.map((row) => (
                <EconomyRow key={row.subject} row={row} accent={accent} highlighted={row.subject === highlightPlayer} />
            ))}
        </div>
    );
}

export function RoundEconomyOverview({ data, highlightPlayer }: RoundEconomyOverviewProps) {
    return (
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] px-5 pt-4 pb-5 mb-4">
            <div className="text-xs tracking-wide font-semibold text-[#5d6b78] mb-3">ECONOMY</div>
            <BuyBalanceBar attackerTotal={data.attackerTotal} defenderTotal={data.defenderTotal} />
            <div className="grid grid-cols-2 gap-8">
                <EconomyColumn
                    title="ATTACKERS"
                    accent={ROLE_ACCENT[TWO_TEAM_ROLE_IDS.ATTACKER]}
                    rows={data.attackers}
                    total={data.attackerTotal}
                    highlightPlayer={highlightPlayer}
                />
                <EconomyColumn
                    title="DEFENDERS"
                    accent={ROLE_ACCENT[TWO_TEAM_ROLE_IDS.DEFENDER]}
                    rows={data.defenders}
                    total={data.defenderTotal}
                    highlightPlayer={highlightPlayer}
                />
            </div>
        </div>
    );
}
