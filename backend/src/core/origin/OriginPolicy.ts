import { Injectable } from '@nestjs/common';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

const DEV_SERVER_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

@Injectable()
export class OriginPolicy {
    readonly appOrigins: readonly string[];
    private readonly externalOrigins: ReadonlySet<string>;

    constructor(@InjectConfig() config: AppConfig) {
        const app = config.configurations.app;
        this.appOrigins = [
            `http://127.0.0.1:${app.port}`,
            `http://localhost:${app.port}`,
            ...app['additional-cors-origins'],
            ...(process.env.NODE_ENV === 'development' ? DEV_SERVER_ORIGINS : []),
        ];
        this.externalOrigins = new Set();
    }

    isAppOrigin(origin: string | undefined): boolean {
        return origin !== undefined && this.appOrigins.includes(origin);
    }

    isExternalOrigin(origin: string | undefined): boolean {
        return origin !== undefined && this.externalOrigins.has(origin);
    }
}
