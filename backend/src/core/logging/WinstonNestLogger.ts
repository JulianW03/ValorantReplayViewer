import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { inspect } from 'node:util';
import winston from 'winston';
import { WINSTON_LEVEL_FOR_NEST_LEVEL } from '@/core/logging/createLoggerOptions';

export class WinstonNestLogger extends ConsoleLogger {
    constructor(private readonly winstonLogger: winston.Logger) {
        super({ logLevels: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'] });
    }

    protected override printMessages(
        messages: unknown[],
        context = '',
        logLevel: LogLevel = 'log',
        _writeStreamType?: 'stdout' | 'stderr',
        errorStack?: unknown,
    ): void {
        for (const message of messages) {
            const text = typeof message === 'string' ? message : inspect(message, { depth: 5 });
            this.winstonLogger.log({
                level: WINSTON_LEVEL_FOR_NEST_LEVEL[logLevel],
                context,
                message: typeof errorStack === 'string' ? `${text}\n${errorStack}` : text,
            });
        }
    }

    protected override printStackTrace(): void {
    }
}
