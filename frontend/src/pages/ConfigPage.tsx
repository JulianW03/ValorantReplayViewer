import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2, RotateCcw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
    useConfigOverrides,
    useDeleteConfigOverrides,
    useEffectiveConfig,
    useSaveConfigOverrides,
} from '@/lib/queries'
import type { ConfigOverrides, EffectiveConfig, LogLevel, SupportedRegion, SupportedShard } from '@/lib/api'
import { LOG_LEVELS, SUPPORTED_REGIONS, SUPPORTED_SHARDS } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'

// ── types ──────────────────────────────────────────────────────────────────

interface FormState {
    // overrides.valorant-api
    region: SupportedRegion | ''
    shard: SupportedShard | ''
    // overrides.valorant-version-read
    version: string
    // configurations.app
    port: string
    corsOrigins: string[]
    // configurations.app.logging
    logLevels: LogLevel[]
    fileLogLevels: LogLevel[]
    maxLogFiles: string
    // configurations.valorant-version-read
    retryTimeoutMs: string
    regex: string
    // configurations.update-check
    updateCheckIntervalSeconds: string
    githubUser: string
    githubRepo: string
    // filepaths
    riotGamesFolderEnvVar: string
    riotGamesFolderPath: string               // newline-delimited segments
    valorantSavedEnvVar: string
    valorantSavedPath: string
}

const EMPTY_FORM: FormState = {
    region: '',
    shard: '',
    version: '',
    port: '',
    corsOrigins: [],
    logLevels: [],
    fileLogLevels: [],
    maxLogFiles: '',
    retryTimeoutMs: '',
    regex: '',
    updateCheckIntervalSeconds: '',
    githubUser: '',
    githubRepo: '',
    riotGamesFolderEnvVar: '',
    riotGamesFolderPath: '',
    valorantSavedEnvVar: '',
    valorantSavedPath: '',
}

// ── serialisation ─────────────────────────────────────────────────────────

function overridesToForm(overrides: ConfigOverrides | null): FormState {
    if (!overrides) return EMPTY_FORM
    const o = overrides.overrides
    const cfg = (overrides as any).configurations
    const fp = (overrides as any).filepaths
    return {
        region: o?.['valorant-api']?.region ?? '',
        shard: o?.['valorant-api']?.shard ?? '',
        version: o?.['valorant-version-read']?.version ?? '',
        port: cfg?.app?.port != null ? String(cfg.app.port) : '',
        corsOrigins: cfg?.app?.['additional-cors-origins'] ?? [],
        logLevels: cfg?.app?.logging?.levels ?? [],
        fileLogLevels: cfg?.app?.logging?.['file-levels'] ?? [],
        maxLogFiles: cfg?.app?.logging?.['max-log-files'] != null ? String(cfg.app.logging['max-log-files']) : '',
        retryTimeoutMs: cfg?.['valorant-version-read']?.['retry-timeout-ms'] != null
            ? String(cfg['valorant-version-read']['retry-timeout-ms'])
            : '',
        regex: cfg?.['valorant-version-read']?.regex ?? '',
        updateCheckIntervalSeconds: cfg?.['update-check']?.['check-interval-seconds'] != null
            ? String(cfg['update-check']['check-interval-seconds'])
            : '',
        githubUser: cfg?.['update-check']?.['github-user'] ?? '',
        githubRepo: cfg?.['update-check']?.['github-repo'] ?? '',
        riotGamesFolderEnvVar: fp?.['riot-games-folder']?.relativeToEnvVar ?? '',
        riotGamesFolderPath: (fp?.['riot-games-folder']?.path ?? []).join('\n'),
        valorantSavedEnvVar: fp?.['valorant-saved']?.relativeToEnvVar ?? '',
        valorantSavedPath: (fp?.['valorant-saved']?.path ?? []).join('\n'),
    }
}

function omitUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as Partial<T>
}

// The backend validates `logging` and `update-check` as whole objects, so a partial override
// is completed with the currently effective values.
function formToOverrides(form: FormState, effective: EffectiveConfig | undefined): ConfigOverrides {
    const rgPath = form.riotGamesFolderPath.split('\n').map(s => s.trim()).filter(Boolean)
    const vsPath = form.valorantSavedPath.split('\n').map(s => s.trim()).filter(Boolean)
    const effApp = effective?.configurations.app
    const effUpdateCheck = effective?.configurations['update-check']

    const valorantApi = omitUndefined({
        region: form.region || undefined,
        shard: form.shard || undefined,
    })
    const valorantVersionReadOverrides = omitUndefined({
        version: form.version || undefined,
    })

    const logging = (form.logLevels.length || form.fileLogLevels.length || form.maxLogFiles)
        ? omitUndefined({
            levels: form.logLevels.length ? form.logLevels : effApp?.logging.levels,
            'file-levels': form.fileLogLevels.length ? form.fileLogLevels : undefined,
            'max-log-files': form.maxLogFiles ? Number(form.maxLogFiles) : effApp?.logging['max-log-files'],
        })
        : undefined
    const appConfig = omitUndefined({
        port: form.port ? Number(form.port) : undefined,
        logging,
        'additional-cors-origins': form.corsOrigins.length ? form.corsOrigins : undefined,
    })
    const valorantVersionReadConfig = omitUndefined({
        'retry-timeout-ms': form.retryTimeoutMs ? Number(form.retryTimeoutMs) : undefined,
        regex: form.regex || undefined,
    })
    const updateCheck = (form.updateCheckIntervalSeconds || form.githubUser || form.githubRepo)
        ? {
            'check-interval-seconds': form.updateCheckIntervalSeconds
                ? Number(form.updateCheckIntervalSeconds)
                : effUpdateCheck?.['check-interval-seconds'],
            'github-user': form.githubUser || effUpdateCheck?.['github-user'],
            'github-repo': form.githubRepo || effUpdateCheck?.['github-repo'],
        }
        : undefined

    const riotGamesFolder = (form.riotGamesFolderEnvVar || rgPath.length)
        ? omitUndefined({
            relativeToEnvVar: form.riotGamesFolderEnvVar || undefined,
            path: rgPath.length ? rgPath : undefined,
        })
        : undefined
    const valorantSaved = (form.valorantSavedEnvVar || vsPath.length)
        ? omitUndefined({
            relativeToEnvVar: form.valorantSavedEnvVar || undefined,
            path: vsPath.length ? vsPath : undefined,
        })
        : undefined

    const overrides = omitUndefined({
        'valorant-api': Object.keys(valorantApi).length ? valorantApi : undefined,
        'valorant-version-read': Object.keys(valorantVersionReadOverrides).length ? valorantVersionReadOverrides : undefined,
    })
    const configurations = omitUndefined({
        app: Object.keys(appConfig).length ? appConfig : undefined,
        'valorant-version-read': Object.keys(valorantVersionReadConfig).length ? valorantVersionReadConfig : undefined,
        'update-check': updateCheck,
    })
    const filepaths = omitUndefined({
        'riot-games-folder': riotGamesFolder,
        'valorant-saved': valorantSaved,
    })

    return omitUndefined({
        overrides: Object.keys(overrides).length ? overrides : undefined,
        configurations: Object.keys(configurations).length ? configurations : undefined,
        filepaths: Object.keys(filepaths).length ? filepaths : undefined,
    }) as ConfigOverrides
}

// ── sub-components ─────────────────────────────────────────────────────────

function FieldRow({ label, description, effective, children }: {
    label: string
    description?: string
    effective?: string | null
    children: React.ReactNode
}) {
    return (
        <div className="grid grid-cols-[1fr_1.2fr] gap-6 py-4 border-b border-border last:border-0">
            <div>
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
                {effective != null && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/60">Effective:</span>{' '}
                        <span className="font-mono">{effective || '—'}</span>
                    </p>
                )}
            </div>
            <div className="flex items-start pt-0.5">{children}</div>
        </div>
    )
}

function NativeSelect({ value, onChange, options, placeholder, disabled }: {
    value: string
    onChange: (v: string) => void
    options: readonly string[]
    placeholder: string
    disabled?: boolean
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
                'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
                'focus:outline-none focus:ring-1 focus:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
            )}
        >
            <option value="">{placeholder}</option>
            {options.map(opt => (
                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
            ))}
        </select>
    )
}

function TagInput({ value, onChange, placeholder, disabled }: {
    value: string[]
    onChange: (v: string[]) => void
    placeholder?: string
    disabled?: boolean
}) {
    const [draft, setDraft] = useState('')

    function add() {
        const v = draft.trim()
        if (v && !value.includes(v)) onChange([...value, v])
        setDraft('')
    }

    return (
        <div className="flex flex-col gap-2 w-full">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs font-mono bg-muted border border-border rounded px-2 py-0.5">
                            {tag}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                                    className="text-muted-foreground hover:text-foreground leading-none"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
                    Add
                </Button>
            </div>
        </div>
    )
}

function LogLevelPicker({ value, onChange, disabled }: {
    value: LogLevel[]
    onChange: (v: LogLevel[]) => void
    disabled?: boolean
}) {
    function toggle(level: LogLevel, checked: boolean) {
        onChange(checked ? LOG_LEVELS.filter(l => l === level || value.includes(l)) : value.filter(l => l !== level))
    }

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {LOG_LEVELS.map(level => (
                <label key={level} className="flex items-center gap-1.5 text-sm font-mono">
                    <Checkbox
                        checked={value.includes(level)}
                        onCheckedChange={checked => toggle(level, checked === true)}
                        disabled={disabled}
                    />
                    {level}
                </label>
            ))}
        </div>
    )
}

// ── page ───────────────────────────────────────────────────────────────────

export function ConfigPage() {
    const { data: effectiveConfig, isLoading: loadingEffective } = useEffectiveConfig()
    const { data: savedOverrides, isLoading: loadingOverrides } = useConfigOverrides()
    const { mutate: saveOverrides, isPending: isSaving, isSuccess: saveSuccess, isError: saveError } = useSaveConfigOverrides()
    const { mutate: deleteOverrides, isPending: isDeleting } = useDeleteConfigOverrides()

    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [isDirty, setIsDirty] = useState(false)

    useEffect(() => {
        if (!loadingOverrides) {
            setForm(overridesToForm(savedOverrides ?? null))
            setIsDirty(false)
        }
    }, [savedOverrides, loadingOverrides])

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }))
        setIsDirty(true)
    }

    function handleSave() {
        saveOverrides(formToOverrides(form, effectiveConfig), { onSuccess: () => setIsDirty(false) })
    }

    function handleReset() {
        deleteOverrides(undefined, {
            onSuccess: () => { setForm(EMPTY_FORM); setIsDirty(false) },
        })
    }

    const isLoading = loadingEffective || loadingOverrides
    const isBusy = isSaving || isDeleting

    const eff = effectiveConfig as any
    const effRegion = eff?.overrides?.['valorant-api']?.region
    const effShard = eff?.overrides?.['valorant-api']?.shard
    const effVersion = eff?.overrides?.['valorant-version-read']?.version
    const effPort = eff?.configurations?.app?.port
    const effRetry = eff?.configurations?.['valorant-version-read']?.['retry-timeout-ms']
    const effRegex = eff?.configurations?.['valorant-version-read']?.regex
    const effLogging = effectiveConfig?.configurations?.app?.logging
    const effUpdateCheck = effectiveConfig?.configurations?.['update-check']
    const cfgVersion = eff?.version?.config
    const appVersion = eff?.version?.app

    return (
        <div className="flex w-full flex-col gap-4">

            {/* Header */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
                <div>
                    <p className="text-sm font-medium">Configuration overrides</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Override specific values from the default config. All changes take effect after a backend restart.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {saveSuccess && !isDirty && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                            <CheckCircle2 className="size-3.5" /> Saved
                        </span>
                    )}
                    {saveError && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="size-3.5" /> Failed to save
                        </span>
                    )}
                    <ConfirmDialog
                        title="Reset to defaults"
                        description="This will delete your config overrides file and restore all settings to their default values. A backend restart is required for changes to take effect."
                        confirmLabel="Reset"
                        onConfirm={handleReset}
                    >
                        <Button size="sm" variant="outline" disabled={isBusy || isLoading}>
                            {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                            Reset to defaults
                        </Button>
                    </ConfirmDialog>
                    <Button size="sm" onClick={handleSave} disabled={isBusy || isLoading || !isDirty}>
                        {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-yellow-400">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>
                    <p className="text-sm font-medium">Only use this if you know exactly what you are doing</p>
                    <p className="mt-0.5 text-xs text-yellow-400/70">
                        Config overrides bypass the automatic defaults and can break the application if set incorrectly.
                        Leave all fields blank to use the built-in defaults.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading configuration…
                </div>
            ) : (
                <>
                    {/* App */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">App</p>
                        <FieldRow label="Port" description="HTTP port the backend listens on." effective={effPort != null ? String(effPort) : null}>
                            <Input
                                type="number" min={1} max={65535}
                                value={form.port}
                                onChange={e => update('port', e.target.value)}
                                placeholder="Default: 3000"
                                className="font-mono"
                                disabled={isBusy}
                            />
                        </FieldRow>
                        <FieldRow label="Additional CORS origins" description="Extra origins allowed by the CORS policy.">
                            <TagInput
                                value={form.corsOrigins}
                                onChange={v => update('corsOrigins', v)}
                                placeholder="https://example.com"
                                disabled={isBusy}
                            />
                        </FieldRow>
                    </div>

                    {/* Logging */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Logging</p>
                        <FieldRow label="Console log levels" description="Levels written to the console. None selected keeps the default."
                                  effective={effLogging ? effLogging.levels.join(', ') : null}>
                            <LogLevelPicker value={form.logLevels} onChange={v => update('logLevels', v)} disabled={isBusy} />
                        </FieldRow>
                        <FieldRow label="File log levels" description="Levels written to the log file. None selected uses the console log levels."
                                  effective={effLogging ? (effLogging['file-levels'] ?? effLogging.levels).join(', ') : null}>
                            <LogLevelPicker value={form.fileLogLevels} onChange={v => update('fileLogLevels', v)} disabled={isBusy} />
                        </FieldRow>
                        <FieldRow label="Max log files" description="Number of log files kept before the oldest is deleted."
                                  effective={effLogging ? String(effLogging['max-log-files']) : null}>
                            <Input
                                type="number" min={1} step={1}
                                value={form.maxLogFiles}
                                onChange={e => update('maxLogFiles', e.target.value)}
                                placeholder="Default: 10"
                                className="font-mono"
                                disabled={isBusy}
                            />
                        </FieldRow>
                    </div>

                    {/* Valorant API */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Valorant API</p>
                        <FieldRow label="Region" description="Override the detected Valorant region." effective={effRegion ?? null}>
                            <NativeSelect value={form.region} onChange={v => update('region', v as SupportedRegion | '')}
                                          options={SUPPORTED_REGIONS} placeholder="Default (auto-detect)" disabled={isBusy} />
                        </FieldRow>
                        <FieldRow label="Shard" description="Override the shard derived from the region." effective={effShard ?? null}>
                            <NativeSelect value={form.shard} onChange={v => update('shard', v as SupportedShard | '')}
                                          options={SUPPORTED_SHARDS} placeholder="Default (derived from region)" disabled={isBusy} />
                        </FieldRow>
                    </div>

                    {/* Version read */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</p>
                        <FieldRow label="Version override" description="Pin a specific Valorant version string instead of reading it from the client." effective={effVersion ?? null}>
                            <Input value={form.version} onChange={e => update('version', e.target.value)}
                                   placeholder="eg. release-12.07-shipping-9-4488404" disabled={isBusy} />
                        </FieldRow>
                        <FieldRow label="Retry timeout (ms)" description="Milliseconds to wait between version read retries." effective={effRetry != null ? String(effRetry) : null}>
                            <Input type="number" min={100} step={100}
                                   value={form.retryTimeoutMs}
                                   onChange={e => update('retryTimeoutMs', e.target.value)}
                                   placeholder="Default: 5000"
                                   className="font-mono"
                                   disabled={isBusy}
                            />
                        </FieldRow>
                        <FieldRow label="Version regex" description="Regex pattern used to parse the version string from the client." effective={effRegex ?? null}>
                            <Input value={form.regex} onChange={e => update('regex', e.target.value)}
                                   placeholder={effectiveConfig?.configurations?.['valorant-version-read']?.regex} className="font-mono text-xs" disabled={isBusy} />
                        </FieldRow>
                    </div>

                    {/* Update check */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Update check</p>
                        <FieldRow label="Check interval (s)" description="Seconds between checks for a new release."
                                  effective={effUpdateCheck ? String(effUpdateCheck['check-interval-seconds']) : null}>
                            <Input
                                type="number" min={1} step={60}
                                value={form.updateCheckIntervalSeconds}
                                onChange={e => update('updateCheckIntervalSeconds', e.target.value)}
                                placeholder="Default: 1800"
                                className="font-mono"
                                disabled={isBusy}
                            />
                        </FieldRow>
                        <FieldRow label="GitHub repository"
                                  description="Repository whose releases are offered as updates. Only change this to a repository you trust, the update notification links to its downloads."
                                  effective={effUpdateCheck ? `${effUpdateCheck['github-user']}/${effUpdateCheck['github-repo']}` : null}>
                            <div className="flex w-full items-center gap-2">
                                <Input value={form.githubUser} onChange={e => update('githubUser', e.target.value)}
                                       placeholder="User" className="font-mono" disabled={isBusy} />
                                <span className="text-muted-foreground">/</span>
                                <Input value={form.githubRepo} onChange={e => update('githubRepo', e.target.value)}
                                       placeholder="Repository" className="font-mono" disabled={isBusy} />
                            </div>
                        </FieldRow>
                    </div>

                    {/* Filepaths */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">File paths</p>
                        <FieldRow label="Riot Games folder" description="Path segments to the Riot Games installation folder.">
                            <div className="flex flex-col gap-2 w-full">
                                <Input value={form.riotGamesFolderEnvVar}
                                       onChange={e => update('riotGamesFolderEnvVar', e.target.value)}
                                       placeholder="Relative to env var (optional)"
                                       className="font-mono text-xs" disabled={isBusy} />
                                <Textarea value={form.riotGamesFolderPath}
                                          onChange={e => update('riotGamesFolderPath', e.target.value)}
                                          placeholder={"One path segment per line."}
                                          className="font-mono text-xs resize-none" rows={3} disabled={isBusy} />
                            </div>
                        </FieldRow>
                        <FieldRow label="Valorant saved" description="Path segments to the Valorant saved data folder.">
                            <div className="flex flex-col gap-2 w-full">
                                <Input value={form.valorantSavedEnvVar}
                                       onChange={e => update('valorantSavedEnvVar', e.target.value)}
                                       placeholder="Relative to env var (optional)"
                                       className="font-mono text-xs" disabled={isBusy} />
                                <Textarea value={form.valorantSavedPath}
                                          onChange={e => update('valorantSavedPath', e.target.value)}
                                          placeholder={"One path segment per line"}
                                          className="font-mono text-xs resize-none" rows={3} disabled={isBusy} />
                            </div>
                        </FieldRow>
                    </div>

                    {/* Read-only app version info */}
                    <div className="rounded-lg border border-border bg-card px-5 py-2">
                        <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">App version (read-only)</p>
                        <FieldRow label="Config version" description="Numeric config schema version.">
                            <span className="font-mono text-sm text-muted-foreground">{cfgVersion ?? '—'}</span>
                        </FieldRow>
                        <FieldRow label="App semver" description="Application semantic version string.">
                            <span className="font-mono text-sm text-muted-foreground">{appVersion ?? '—'}</span>
                        </FieldRow>
                    </div>
                </>
            )}
        </div>
    )
}