import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { OriginGuard, PREFIX_EXTERNAL } from '@/core/origin/OriginGuard';
import { OriginPolicy } from '@/core/origin/OriginPolicy';
import { AppConfigurationConfig } from '@/config/ConfigV1.schema';
import type { AppConfig } from '@/config/configLoader';

const APP_ORIGIN = 'http://localhost:3000';
const FOREIGN_ORIGIN = 'https://external.somedomain.com';

const guard = new OriginGuard(
    new OriginPolicy({
        configurations: {
            app: AppConfigurationConfig.parse({ port: 3000, logging: { levels: ['log'] } }),
        },
    } as AppConfig),
);

function canActivate(url: string, origin?: string): boolean {
    const request = { originalUrl: url, headers: origin === undefined ? {} : { origin } };
    return guard.canActivate(new ExecutionContextHost([request, {}, () => {}]));
}

const EXTERNAL_URL = `/api/v1/${PREFIX_EXTERNAL}/shares`;
const APP_URL = '/api/v1/replays';

describe('OriginGuard', () => {
    it('allows app origins and requests without an origin on app routes', () => {
        expect(canActivate(APP_URL, APP_ORIGIN)).toBe(true);
        expect(canActivate(APP_URL)).toBe(true);
    });

    it('rejects foreign origins on app routes', () => {
        expect(() => canActivate(APP_URL, FOREIGN_ORIGIN)).toThrow(ForbiddenException);
    });

    it('rejects app origins, foreign origins and missing origins on external routes', () => {
        expect(() => canActivate(EXTERNAL_URL, APP_ORIGIN)).toThrow(ForbiddenException);
        expect(() => canActivate(EXTERNAL_URL, FOREIGN_ORIGIN)).toThrow(ForbiddenException);
        expect(() => canActivate(EXTERNAL_URL)).toThrow(ForbiddenException);
    });

    it('treats external routes case-insensitively, like Express routing', () => {
        expect(() => canActivate(`/API/V1/${PREFIX_EXTERNAL.toUpperCase()}/shares`, APP_ORIGIN)).toThrow(ForbiddenException);
    });

    it('treats routes that merely start with the prefix as app routes', () => {
        expect(canActivate(`/api/v1/${PREFIX_EXTERNAL}ish`, APP_ORIGIN)).toBe(true);
    });
});
