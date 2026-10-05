import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConsoleLogger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as process from 'node:process';
import 'reflect-metadata';
import { ShutdownManager } from '@/modules/ShutdownModule/ShutdownManager';
import { SYMBOL_CONFIG } from '@/config/configLoader';
import { EnvConfigV1DTO, LogLevelSchema } from '@/config/ConfigV1.schema';
import { WinstonNestLogger } from '@/core/logging/WinstonNestLogger';

async function bootstrap() {
    const isDev = process.env.NODE_ENV === 'development';
    const logLevel = isDev
        ? [LogLevelSchema.enum.log, LogLevelSchema.enum.error, LogLevelSchema.enum.warn, LogLevelSchema.enum.debug, LogLevelSchema.enum.verbose]
        : [LogLevelSchema.enum.log, LogLevelSchema.enum.error, LogLevelSchema.enum.warn];

    const setupLogger = new ConsoleLogger({
        logLevels: logLevel,
    });

    const app = await NestFactory.create(AppModule, {
        logger: setupLogger,
    });
    const configuration = app.get<EnvConfigV1DTO>(SYMBOL_CONFIG);
    setupLogger.log("Done with Nest Setup, Switching to configured logging mechanism now.")
    app.useLogger(app.get(WinstonNestLogger));

    const configuredPort = configuration.configurations.app.port;
    const corsOrigin = [`http://127.0.0.1:${configuredPort}`, `http://localhost:${configuredPort}`, ...configuration.configurations.app['additional-cors-origins']];
    if (isDev) {
        corsOrigin.push('http://localhost:5173');
        corsOrigin.push('http://127.0.0.1:5173');
    }

    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
        prefix: 'api/v',
    });
    app.enableShutdownHooks();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.enableCors({ origin: corsOrigin, credentials: false, exposedHeaders: ['ETag'] });

    const shutdownService = app.get(ShutdownManager);
    shutdownService.setApp(app);

    const config = new DocumentBuilder()
        .setTitle('Valorant Replay Viewer')
        .setDescription('')
        .setVersion('1.0')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    await app.listen(configuredPort);
}

bootstrap();
