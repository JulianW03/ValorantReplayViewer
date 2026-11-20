import { MonitorOff } from 'lucide-react';
import { useProductSession } from '@/lib/queries.ts';
import type { ReactNode } from 'react';
import type { ProductSessionDTO } from '@vrv/shared';

type RequireSessionGuardProps = {
    productId: string;
    children: (session: ProductSessionDTO) => ReactNode;
};

export const RequireSessionGuard = (
    {
        productId,
        children,
    }: RequireSessionGuardProps,
) => {

    const session = useProductSession(productId);

    if (!session) {
        return (
            <div
                className="flex flex-col items-center justify-center gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center">
                <MonitorOff className="size-8 text-amber-400" />
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-amber-400">Product with id {productId} is not running</p>
                    <p className="text-xs text-muted-foreground">
                        Launch {productId} and wait for it to reach the main menu before using the injector.
                    </p>
                </div>
            </div>
        );
    }

    return children(session);
};