import { WsAdapter } from '@nestjs/platform-ws';
import { INestApplication } from '@nestjs/common';

export class OriginCheckedWsAdapter extends WsAdapter {
    constructor(app: INestApplication, private readonly allowedOrigins: string[]) {
        super(app);
    }

    create(port: number, options: Record<string, any> = {}) {
        return super.create(port, {
            ...options,
            verifyClient: ({ origin }, cb) => cb(this.allowedOrigins.includes(origin), 403),
        });
    }
}