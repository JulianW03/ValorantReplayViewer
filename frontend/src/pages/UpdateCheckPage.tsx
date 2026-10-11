import { AlertCircle, ArrowUpCircle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { GithubIcon } from '@/components/icons/GithubIcon'
import { useRelativeTime } from '@/hooks/useRelativeTime'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffectiveConfig, useUpdateStatus } from '@/lib/queries'
import {
    UnknownStatusReason,
    UpdateStatusIndicator,
    type UpdateStatus,
} from '#/schemas/updateCheck/UpdateStatus.schema.ts'

const UNKNOWN_REASON_TEXT: Record<z.infer<typeof UnknownStatusReason>, string> = {
    [UnknownStatusReason.enum.NO_FETCH_YET]: 'Checking for updates…',
    [UnknownStatusReason.enum.REMOTE_FETCH_FAILED]: 'Could not reach GitHub to check for updates.',
    [UnknownStatusReason.enum.REMOTE_SCHEMA_INVALID]: 'GitHub returned release information that could not be read.',
    [UnknownStatusReason.enum.VERSION_PARSE_FAILED]: 'The installed app version could not be determined.',
}

function StatusLine({ status }: { status: UpdateStatus }) {
    switch (status.status) {
        case UpdateStatusIndicator.enum.UP_TO_DATE:
            return (
                <span className="flex items-center gap-1.5 text-sm text-green-500">
                    <CheckCircle2 className="size-4" /> You are running the latest version
                </span>
            )
        case UpdateStatusIndicator.enum.UPDATE_AVAILABLE:
            return (
                <span className="flex items-center gap-1.5 text-sm text-primary">
                    <ArrowUpCircle className="size-4" /> Version {status.update_info.version} is available
                </span>
            )
        case UpdateStatusIndicator.enum.UNKNOWN:
            return (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {status.reason === UnknownStatusReason.enum.NO_FETCH_YET
                        ? <Loader2 className="size-4 animate-spin" />
                        : <AlertCircle className="size-4" />}
                    {UNKNOWN_REASON_TEXT[status.reason]}
                </span>
            )
    }
}

function RelativeTime({ iso }: { iso: string }) {
    return useRelativeTime(Date.parse(iso))
}

function InfoRow({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[1fr_1.2fr] gap-6 py-4 border-b border-border last:border-0">
            <p className="text-sm font-medium">{label}</p>
            <div className="font-mono text-sm text-muted-foreground">{children}</div>
        </div>
    )
}

export function UpdateCheckPage() {
    const status = useUpdateStatus()
    const { data: effectiveConfig } = useEffectiveConfig()
    const currentVersion = effectiveConfig?.version?.app

    if (status === null) {
        return (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading update status…
            </div>
        )
    }

    const updateInfo = status.status === UpdateStatusIndicator.enum.UPDATE_AVAILABLE ? status.update_info : null

    return (
        <div className="flex w-full flex-col gap-4">
            <div
                className={cn(
                    'flex items-center justify-between gap-4 rounded-lg border bg-card px-5 py-4',
                    updateInfo ? 'border-primary/40' : 'border-border',
                )}
            >
                <div>
                    <p className="text-sm font-medium">Update check</p>
                    <div className="mt-1"><StatusLine status={status} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">Last checked:{' '}
                        {status.last_check_timestamp
                            ? <RelativeTime iso={status.last_check_timestamp} />
                            : 'Never'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                        <a href={status.repo_url} target="_blank" rel="noreferrer">
                            <GithubIcon className="size-3.5" /> GitHub
                        </a>
                    </Button>
                    {updateInfo && (
                        <Button size="sm" asChild>
                            <a href={updateInfo.download_url} target="_blank" rel="noreferrer">
                                <Download className="size-3.5" /> Download
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-lg border border-border bg-card px-5 py-2">
                <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Versions</p>
                <InfoRow label="Installed version">{currentVersion ?? '—'}</InfoRow>
                {updateInfo && <InfoRow label="Latest version">{updateInfo.version}</InfoRow>}
            </div>

            {updateInfo?.release_notes && (
                <div className="rounded-lg border border-border bg-card px-5 py-2">
                    <p className="py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Release notes</p>
                    <p className="pb-4 text-sm whitespace-pre-wrap text-foreground/80">{updateInfo.release_notes}</p>
                </div>
            )}
        </div>
    )
}
