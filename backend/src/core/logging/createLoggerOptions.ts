import winston from 'winston';
import { utilities as nestWinstonUtilities } from 'nest-winston';
import { LogLevel as NestLogLevel } from '@nestjs/common';
import { LogLevel } from '@/config/ConfigV1.schema';

const WINSTON_LEVELS = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, verbose: 5 };

export const WINSTON_LEVEL_FOR_NEST_LEVEL: Record<NestLogLevel, keyof typeof WINSTON_LEVELS> = {
    fatal: 'fatal',
    log: 'info',
    error: 'error',
    warn: 'warn',
    debug: 'debug',
    verbose: 'verbose',
};

export interface LoggerSettings {
    logFilePath: string;
    consoleLevels: LogLevel[];
    fileLevels: LogLevel[];
}

// Winston levels are thresholds, but the config lists the enabled levels individually.
const onlyLevels = winston.format((info, enabled: Set<string>) =>
    info.level === 'fatal' || info.exception || enabled.has(info.level) ? info : false);

const toWinstonLevels = (levels: LogLevel[]) => new Set(levels.map((level) => WINSTON_LEVEL_FOR_NEST_LEVEL[level]));

const fileLine = winston.format.printf(({ timestamp, level, context, message }) => {
    const label = level === 'info' ? 'LOG' : level.toUpperCase();
    return `${timestamp} ${label} [${context ?? 'Process'}] ${message}`;
});

export function createLoggerOptions({ logFilePath, consoleLevels, fileLevels }: LoggerSettings): winston.LoggerOptions {
    return {
        levels: WINSTON_LEVELS,
        level: 'verbose',
        transports: [
            new winston.transports.Console({
                handleExceptions: true,
                handleRejections: true,
                format: winston.format.combine(
                    onlyLevels(toWinstonLevels(consoleLevels)),
                    winston.format.timestamp(),
                    nestWinstonUtilities.format.nestLike('VRV', { colors: true, prettyPrint: true }),
                ),
            }),
            new winston.transports.File({
                filename: logFilePath,
                handleExceptions: true,
                handleRejections: true,
                format: winston.format.combine(
                    onlyLevels(toWinstonLevels(fileLevels)),
                    winston.format.timestamp(),
                    fileLine,
                ),
            }),
        ],
    };
}
