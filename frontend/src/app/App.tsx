import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ConnectPage } from '@/pages/ConnectPage';
import { RecentMatchesPage } from '@/pages/RecentMatchesPage';
import { SavedReplaysPage } from '@/pages/SavedReplaysPage';
import { InjectorPage } from '@/pages/InjectorPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { UpdateCheckPage } from '@/pages/UpdateCheckPage';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAgentRegistry, useMapRegistry } from '@/lib/queries';
import { RequireSessionGuard } from '@/components/RequireSessionGuard.tsx';
import MatchDetailsPage from '@/pages/MatchDetailsPage.tsx';

const router = createHashRouter([
    {
        path: "/connect",
        element: <ConnectPage />,
    },
    {
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <Navigate to="/recent" replace />,
            },
            {
                path: "saved",
                element: <SavedReplaysPage />,
                handle: {
                    title: "Saved Replays",
                },
            },
            {
                path: "details/saved/:matchId",
                element: <MatchDetailsPage />,
                handle: {
                    title: "Match Details",
                },
            },
            {
                path: "recent",
                handle: {
                    title: "Recent Matches",
                },
                element: (
                    <RequireSessionGuard productId="valorant">
                        {() => <RecentMatchesPage />}
                    </RequireSessionGuard>
                ),
            },
            {
                path: "injector",
                handle: {
                    title: "Injector",
                },
                element: (
                    <RequireSessionGuard productId="valorant">
                        {() => <InjectorPage />}
                    </RequireSessionGuard>
                ),
            },
            {
                path: "config",
                element: <ConfigPage />,
                handle: {
                    title: "Configuration",
                },
            },
            {
                path: "update-check",
                element: <UpdateCheckPage />,
                handle: {
                    title: "Update Check",
                },
            },
            {
                path: "*",
                element: <Navigate to="/recent" replace />,
            },
        ],
    },
]);

export default function App() {
    useWebSocket();
    useMapRegistry();
    useAgentRegistry();

    return <RouterProvider router={router} />;
}
