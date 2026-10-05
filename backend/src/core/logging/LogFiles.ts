import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE_PATTERN = /^VRV-.+\.log$/;

const pad = (value: number) => String(value).padStart(2, '0');

function formatFileTimestamp(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function prepareLogFile(logDir: string, maxFiles: number, now = new Date()): string {
    fs.mkdirSync(logDir, { recursive: true });

    const existing = fs.readdirSync(logDir)
        .filter((name) => LOG_FILE_PATTERN.test(name))
        .sort();
    const toRemove = existing.slice(0, Math.max(0, existing.length - (maxFiles - 1)));
    for (const name of toRemove) {
        fs.rmSync(path.join(logDir, name), { force: true });
    }

    return path.join(logDir, `VRV-${formatFileTimestamp(now)}.log`);
}
