import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AddressInfo } from 'node:net';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { listenOnLoopback } from '@/core/http/listenOnLoopback';

@Module({})
class EmptyModule {}

describe('listenOnLoopback', () => {
    let app: INestApplication;
    let boundTo: AddressInfo;

    beforeAll(async () => {
        app = await NestFactory.create(EmptyModule, { logger: false });
        await listenOnLoopback(app, 0);
        boundTo = app.getHttpServer().address() as AddressInfo;
    });

    afterAll(async () => {
        await app.close();
    });

    it('binds only to the loopback interface, so the server is not reachable from the network', () => {
        expect(boundTo.address).toBe('127.0.0.1');
    });

    it('serves requests on the loopback address', async () => {
        const response = await fetch(`http://127.0.0.1:${boundTo.port}/`);
        expect(response.status).toBe(404);
    });
});
