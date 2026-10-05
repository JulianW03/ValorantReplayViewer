import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import winston from 'winston';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { WinstonNestLogger } from '@/core/logging/WinstonNestLogger';
import { createLoggerOptions, LoggerSettings } from '@/core/logging/createLoggerOptions';

describe('createLoggerOptions', () => {
    let logDir: string;
    let logFilePath: string;

    beforeEach(() => {
        logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrv-logs-'));
        logFilePath = path.join(logDir, 'VRV-test.log');
    });

    afterEach(() => {
        fs.rmSync(logDir, { recursive: true, force: true });
    });

    async function logAndReadFile(settings: Omit<LoggerSettings, 'logFilePath'>, write: (logger: WinstonNestLogger) => void) {
        const options = createLoggerOptions({ logFilePath, ...settings });
        const winstonLogger = winston.createLogger(options);
        const fileTransport = winstonLogger.transports.find((t) => t instanceof winston.transports.File)!;
        const finished = new Promise((resolve) => fileTransport.once('finish', resolve));

        write(new WinstonNestLogger(winstonLogger));
        winstonLogger.end();
        await finished;
        winstonLogger.close();
        return fs.readFileSync(logFilePath, 'utf8');
    }

    it('writes only the file levels to the file, independent of the console levels', async () => {
        const content = await logAndReadFile({ consoleLevels: [], fileLevels: ['log', 'error'] }, (logger) => {
            logger.log('hello file', 'TestContext');
            logger.debug('should not appear', 'TestContext');
            logger.error('it broke', 'some stack trace', 'TestContext');
        });

        expect(content).toMatch(/LOG \[TestContext\] hello file/);
        expect(content).toMatch(/ERROR \[TestContext\] it broke\nsome stack trace/);
        expect(content).not.toContain('should not appear');
    });

    it('keeps the class context when Nest loggers pass extra values', async () => {
        const content = await logAndReadFile({ consoleLevels: [], fileLevels: ['log', 'warn', 'debug'] }, (adapter) => {
            Logger.overrideLogger(adapter);
            const logger = new Logger('VersionInfoManager');
            logger.warn('Failed to fetch version info', new Error('No version info found'));
            logger.debug('Retrying, iterations remaining', 4);
            logger.log('Fetched remote config', { region: 'eu' });
            Logger.overrideLogger(new ConsoleLogger());
        });

        expect(content).toMatch(/WARN \[VersionInfoManager\] Failed to fetch version info\r?\n.*WARN \[VersionInfoManager\] Error: No version info found\n\s+at /);
        expect(content).toMatch(/DEBUG \[VersionInfoManager\] 4/);
        expect(content).toMatch(/LOG \[VersionInfoManager\] \{ region: 'eu' \}/);
        expect(content).not.toContain('[object Object]');
    });

    it('keeps every line logged before an uncaught exception and the exception itself', () => {
        const fixture = path.join(__dirname, 'fixtures', 'crashingProcess.ts');
        const result = spawnSync(
            process.execPath,
            ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', fixture, logFilePath, '500'],
            { env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' }, encoding: 'utf8' },
        );

        const content = fs.readFileSync(logFilePath, 'utf8');
        expect(result.status).not.toBe(0);
        expect(content).toContain('[Fixture] line 0');
        expect(content).toContain('[Fixture] line 499');
        expect(content).toContain('uncaughtException: fixture crash');
    }, 30_000);
});
