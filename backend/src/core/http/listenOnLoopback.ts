import { INestApplication } from '@nestjs/common';

export const LOOPBACK_HOST = '127.0.0.1';

export function listenOnLoopback(app: INestApplication, port: number): Promise<unknown> {
    return app.listen(port, LOOPBACK_HOST);
}
