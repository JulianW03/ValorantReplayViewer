import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareLogFile } from '@/core/logging/LogFiles';

describe('prepareLogFile', () => {
    let logDir: string;

    beforeEach(() => {
        logDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vrv-logs-')), 'logs');
    });

    afterEach(() => {
        fs.rmSync(path.dirname(logDir), { recursive: true, force: true });
    });

    it('returns a VRV-[DATE_TIME].log path inside a created log directory', () => {
        const logFile = prepareLogFile(logDir, 5, new Date(2026, 9, 1, 14, 5, 9));

        expect(fs.existsSync(logDir)).toBe(true);
        expect(logFile).toBe(path.join(logDir, 'VRV-2026-10-01_14-05-09.log'));
    });

    it('removes the oldest log files so that at most maxFiles remain including the new one', () => {
        fs.mkdirSync(logDir);
        for (let day = 1; day <= 5; day++) {
            fs.writeFileSync(path.join(logDir, `VRV-2020-01-0${day}_00-00-00.log`), '');
        }
        fs.writeFileSync(path.join(logDir, 'unrelated.txt'), '');

        prepareLogFile(logDir, 3);

        expect(fs.readdirSync(logDir).sort()).toEqual([
            'VRV-2020-01-04_00-00-00.log',
            'VRV-2020-01-05_00-00-00.log',
            'unrelated.txt',
        ]);
    });
});
