import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { OriginPolicy } from '@/core/origin/OriginPolicy';

export const PREFIX_EXTERNAL = 'external';

// Case-insensitive because Express routing is, so /API/V1/EXTERNAL/... still reaches external controllers.
const EXTERNAL_ROUTE = new RegExp(String.raw`^/api/v\d+/${PREFIX_EXTERNAL}(?:[/?]|$)`, 'i');

export function isExternalRoute(url: string | undefined): boolean {
    return url !== undefined && EXTERNAL_ROUTE.test(url);
}

/**
 * CORS headers only stop the browser from reading a response; the request itself still executes.
 * This rejects requests from origins that are not allowed before they reach a handler.
 */
@Injectable()
export class OriginGuard implements CanActivate {
    constructor(private readonly policy: OriginPolicy) {}

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== 'http') {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const origin = request.headers.origin;
        const allowed = isExternalRoute(request.originalUrl)
            ? this.policy.isExternalOrigin(origin)
            : origin === undefined || this.policy.isAppOrigin(origin);

        if (!allowed) {
            throw new ForbiddenException('Origin not allowed');
        }
        return true;
    }
}
