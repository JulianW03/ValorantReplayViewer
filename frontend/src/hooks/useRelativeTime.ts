import {useEffect, useState} from 'react'
import {formatDistanceToNow} from 'date-fns'

/** Returns a reactive relative-time string (e.g. "3 minutes ago") that
 *  automatically re-renders as time passes. */
export function useRelativeTime(millis: number): string {
    const [, forceRerender] = useState(0)

    useEffect(() => {
        const diffMin = (Date.now() - millis) / 60_000
        // Nothing changes for timestamps older than a week
        if (diffMin > 60 * 24 * 7) return
        // Refresh every minute when < 1 h old, every 5 min otherwise
        const interval = diffMin < 60 ? 60_000 : 5 * 60_000
        const id = setInterval(() => forceRerender(n => n + 1), interval)
        return () => clearInterval(id)
    }, [millis])

    return formatDistanceToNow(new Date(millis), {addSuffix: true})
}
