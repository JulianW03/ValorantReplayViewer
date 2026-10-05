import { Module } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import winston from 'winston';
import { PathProviderModule } from '@/modules/PathProvider/PathProviderModule';
import { PathProviderService } from '@/modules/PathProvider/PathProviderService';
import { AppConfig, SYMBOL_CONFIG } from '@/config/configLoader';
import { LogLevelSchema } from '@/config/ConfigV1.schema';
import { prepareLogFile } from '@/core/logging/LogFiles';
import { createLoggerOptions } from '@/core/logging/createLoggerOptions';
import { WinstonNestLogger } from '@/core/logging/WinstonNestLogger';

@Module({
    imports: [
        WinstonModule.forRootAsync({
            imports: [PathProviderModule],
            inject: [PathProviderService, SYMBOL_CONFIG],
            useFactory: (pathProvider: PathProviderService, config: AppConfig) => {
                const logDir = pathProvider.getPersistentPath('logs');
                if (!logDir) {
                    throw new Error('Log directory could not be resolved.');
                }
                const logging = config.configurations.app.logging;
                const isDev = process.env.NODE_ENV === 'development';
                return createLoggerOptions({
                    logFilePath: prepareLogFile(logDir, logging['max-log-files']),
                    consoleLevels: isDev ? [...LogLevelSchema.options] : logging.levels,
                    fileLevels: isDev ? [...LogLevelSchema.options] : logging['file-levels'] ?? logging.levels,
                });
            },
        }),
    ],
    providers: [
        {
            provide: WinstonNestLogger,
            useFactory: (winstonLogger: winston.Logger) => new WinstonNestLogger(winstonLogger),
            inject: [WINSTON_MODULE_PROVIDER],
        },
    ],
    exports: [WinstonNestLogger],
})
export class LoggingModule {}
