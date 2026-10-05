import winston from 'winston';
import { WinstonNestLogger } from '@/core/logging/WinstonNestLogger';
import { createLoggerOptions } from '@/core/logging/createLoggerOptions';

const [logFilePath, lineCount] = process.argv.slice(2);
const logger = new WinstonNestLogger(winston.createLogger(createLoggerOptions({
    logFilePath,
    consoleLevels: [],
    fileLevels: ['log'],
})));

for (let i = 0; i < Number(lineCount); i++) {
    logger.log(`line ${i}`, 'Fixture');
}
throw new Error('fixture crash');
