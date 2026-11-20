import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GUIDSchema } from '@vrv/shared';
import { isPathWithin } from '@/utils/PathUtils';
import { FileRecord } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBService';
import { InvalidMatchIdError } from '@/modules/Valorant/ValorantReplays/storage/ReplayStorageErrors';

export function assertValidMatchId(matchId: string): void {
    if (!GUIDSchema.safeParse(matchId).success) {
        throw new InvalidMatchIdError(matchId);
    }
}

const isNotFound = (e: unknown): boolean =>
    (e as NodeJS.ErrnoException)?.code === 'ENOENT';

export class ReplayFileStore {
    constructor(private readonly root: string) {
    }

    async isSetup(): Promise<boolean> {
        try {
            return (await fs.stat(this.root)).isDirectory();
        } catch (e) {
            if (isNotFound(e)) return false;
            throw e;
        }
    }

    async ensureRoot(): Promise<void> {
        await fs.mkdir(this.root, { recursive: true });
    }

    async removeAll(): Promise<void> {
        await fs.rm(this.root, { recursive: true, force: true });
    }

    async removeMatch(matchId: string): Promise<void> {
        await fs.rm(this.matchDir(matchId), { recursive: true, force: true });
    }

    async write(matchId: string, fileName: string, data: Buffer): Promise<FileRecord> {
        const dir = this.matchDir(matchId);
        await fs.mkdir(dir, { recursive: true });
        const absolute = path.join(dir, fileName);
        await fs.writeFile(absolute, data);
        const stat = await fs.stat(absolute);

        return {
            path: path.posix.join(matchId, fileName),
            sizeBytes: stat.size,
            mtimeS: stat.mtime,
            sha256: createHash('sha256').update(data).digest('hex'),
        };
    }

    async existingPath(record: FileRecord | null | undefined): Promise<string | null> {
        const absolute = this.resolve(record);
        if (!absolute) return null;
        try {
            return (await fs.stat(absolute)).isFile() ? absolute : null;
        } catch (e) {
            if (isNotFound(e)) return null;
            throw e;
        }
    }

    async read(record: FileRecord | null | undefined): Promise<Buffer | null> {
        const absolute = this.resolve(record);
        if (!absolute) return null;
        try {
            return await fs.readFile(absolute);
        } catch (e) {
            if (isNotFound(e)) return null;
            throw e;
        }
    }

    private resolve(record: FileRecord | null | undefined): string | null {
        if (!record) return null;
        const absolute = path.resolve(this.root, record.path);
        return isPathWithin(this.root, absolute) ? absolute : null;
    }

    private matchDir(matchId: string): string {
        assertValidMatchId(matchId);
        return path.join(this.root, matchId);
    }
}
