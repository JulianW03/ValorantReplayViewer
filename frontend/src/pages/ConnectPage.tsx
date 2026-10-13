import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, ServerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConnect, useIsConnected } from '@/lib/queries'
import { ShutdownButton } from '@/components/ShutdownButton'
import { SimpleLogo } from '@/components/icons/SimpleLogo.tsx';

export function ConnectPage() {
  const navigate = useNavigate()
  const { data: isConnected, isLoading, isError } = useIsConnected()
  const { mutate: connect, isPending: isConnecting, error: connectError } = useConnect()

  // Redirect once connected
  useEffect(() => {
    if (isConnected === true) {
      navigate('/saved', { replace: true })
    }
  }, [isConnected, navigate])

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-8 p-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center">
          <SimpleLogo className="size-20 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">VRV</h1>
          <p className="text-sm text-muted-foreground">Valorant Replay Viewer</p>
        </div>
      </div>

      {/* Status card */}
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-border bg-card px-6 py-6 text-center shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Checking connection…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3">
            <ServerOff className="size-6 text-destructive" />
            <div>
              <p className="text-sm font-medium">Backend not reachable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Make sure the VRV backend is running on port 3000.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium">Not connected to Riot Client</p>
              <p className="text-xs text-muted-foreground">
                Make sure VALORANT or the Riot Client is running, then click Connect.
              </p>
            </div>

            {connectError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {connectError instanceof Error ? connectError.message : 'Connection failed'}
              </div>
            )}

            <Button onClick={() => connect()} disabled={isConnecting} className="w-full">
              {isConnecting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  Connect to Riot Client
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Checking automatically every 2 seconds…
            </p>
          </div>
        )}
      </div>

      <ShutdownButton className="absolute bottom-4 left-4 h-8 w-8 text-muted-foreground hover:text-destructive" />
    </div>
  )
}
