import { Injectable } from '@nestjs/common';
import * as schema from '@/db/schema';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, notInArray, sum } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { groupBy } from 'lodash';
import type { ImportFlowId } from '@vrv/shared';
import { ReplayDBConnection } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBConnection';

export interface FileRecord {
    path: string;
    sizeBytes: number;
    mtimeS: Date;
    sha256: string;
}

export interface UserMetadataUpdate {
    name: string;
    notes: string | null;
}

export interface VersionedUserMetadata {
    name: string;
    notes: string | null;
    tags: string[];
    version: number;
}

export interface UserMetadataPatchRecord {
    name?: string;
    notes?: string | null;
    tags?: string[];
}

export type UserMetadataUpdateResult =
    | { kind: 'updated'; record: VersionedUserMetadata }
    | { kind: 'not_found' }
    | { kind: 'version_mismatch'; currentVersion: number };

export interface DownloaderIdentity {
    downloadedAtS: number;
    downloaderPuuid: string;
}

export interface StoredMatchRecord {
    uuid: string;
    importFlowId: ImportFlowId | null;
    metadataFile: FileRecord | null;
    name: string | null;
    notes: string | null;
    tags: string[];
    downloadedAtS: number | null;
    downloaderPuuid: string | null;
    replayFile: FileRecord | null;
}

export interface StoredFileRecords {
    replay?: FileRecord;
    metadata?: FileRecord;
}

type MatchEntryRow = {
    replays: typeof schema.replays.$inferSelect;
    replayCustomizableData: typeof schema.replayCustomizableData.$inferSelect | null;
    metadataFile: typeof schema.file_storage.$inferSelect | null;
    replayFile: typeof schema.file_storage.$inferSelect | null;
};

type FileStorageRow = typeof schema.file_storage.$inferSelect;

type ReplayTx = Parameters<Parameters<BetterSQLite3Database<typeof schema>['transaction']>[0]>[0];

@Injectable()
export class ReplayDBService {
    constructor(private readonly connection: ReplayDBConnection) {
    }

    private get db() {
        return this.connection.db;
    }

    public getAllStoredMatchFileIds() {
        return this.db
            .select({
                uuid: schema.replays.uuid,
                metadataFileUuid: schema.replays.metadata_file_uuid,
                replayFileUuid: schema.replays.replay_file_uuid,
            })
            .from(schema.replays)
            .all();
    }

    public matchExists(matchId: string): boolean {
        return this.db
            .select({ uuid: schema.replays.uuid })
            .from(schema.replays)
            .where(eq(schema.replays.uuid, matchId))
            .get() !== undefined;
    }

    private getMatchEntries(page: number, pageSize: number): MatchEntryRow[] {
        const offset = Math.max(0, (page - 1) * pageSize);
        const metadataFile = alias(schema.file_storage, 'metadata_file');
        const replayFile = alias(schema.file_storage, 'replay_file');

        return this.db
            .select({
                replays: schema.replays,
                replayCustomizableData: schema.replayCustomizableData,
                metadataFile,
                replayFile,
            })
            .from(schema.replays)
            .leftJoin(
                schema.replayCustomizableData,
                eq(schema.replays.uuid, schema.replayCustomizableData.uuid),
            )
            .leftJoin(
                metadataFile,
                eq(metadataFile.uuid, schema.replays.metadata_file_uuid),
            )
            .leftJoin(
                replayFile,
                eq(replayFile.uuid, schema.replays.replay_file_uuid),
            )
            .orderBy(desc(schema.replays.imported_at_s), asc(schema.replays.uuid))
            .limit(pageSize)
            .offset(offset)
            .all();
    }

    private getMatchEntry(matchId: string): MatchEntryRow | undefined {
        const metadataFile = alias(schema.file_storage, 'metadata_file');
        const replayFile = alias(schema.file_storage, 'replay_file');

        return this.db
            .select({
                replays: schema.replays,
                replayCustomizableData: schema.replayCustomizableData,
                metadataFile,
                replayFile,
            })
            .from(schema.replays)
            .leftJoin(
                schema.replayCustomizableData,
                eq(schema.replays.uuid, schema.replayCustomizableData.uuid),
            )
            .leftJoin(
                metadataFile,
                eq(metadataFile.uuid, schema.replays.metadata_file_uuid),
            )
            .leftJoin(
                replayFile,
                eq(replayFile.uuid, schema.replays.replay_file_uuid),
            )
            .where(eq(schema.replays.uuid, matchId))
            .get();
    }

    private getTagsForReplays(replayUuids: string[]) {
        const tags = replayUuids.length > 0
            ? this.db
                .select({
                    replayUuid: schema.replay_tags.replay_uuid,
                    tag: schema.tags,
                })
                .from(schema.replay_tags)
                .innerJoin(
                    schema.tags,
                    eq(schema.replay_tags.tag_id, schema.tags.id),
                )
                .where(
                    inArray(
                        schema.replay_tags.replay_uuid,
                        replayUuids,
                    ),
                )
                .all()
            : [];

        return groupBy(tags, (tag) => tag.replayUuid);
    }

    private toRecord(row: MatchEntryRow, tagNames: string[]): StoredMatchRecord {
        return {
            uuid: row.replays.uuid,
            importFlowId: row.replays.import_flow_id,
            metadataFile: row.metadataFile ? this.toFileRecord(row.metadataFile) : null,
            name: row.replayCustomizableData?.name ?? null,
            notes: row.replayCustomizableData?.notes ?? null,
            tags: tagNames,
            downloadedAtS: row.replays.downloaded_at_s ?? null,
            downloaderPuuid: row.replays.downloader_puuid ?? null,
            replayFile: row.replayFile ? this.toFileRecord(row.replayFile) : null,
        };
    }

    private toFileRecord(row: FileStorageRow): FileRecord {
        return {
            path: row.path,
            sizeBytes: row.size_bytes,
            mtimeS: row.mtime_s,
            sha256: row.sha256,
        };
    }

    public getStoredMatchRecords(
        page: number,
        pageSize: number,
    ): { records: StoredMatchRecord[]; total: number } {
        const rows = this.getMatchEntries(page, pageSize);
        const replayUuids = rows.map(({ replays }) => replays.uuid);
        const tagsByReplayUuid = this.getTagsForReplays(replayUuids);
        const total = this.db
            .select({ count: count() })
            .from(schema.replays)
            .get()?.count ?? 0;

        const records = rows.map((row) => this.toRecord(
            row,
            (tagsByReplayUuid[row.replays.uuid] ?? []).map((entry) => entry.tag.name),
        ));

        return { records, total };
    }

    public getStoredMatchRecord(matchId: string): StoredMatchRecord | undefined {
        const row = this.getMatchEntry(matchId);
        if (!row) {
            return undefined;
        }

        const tags = this.getTagsForReplays([matchId])[matchId] ?? [];
        return this.toRecord(row, tags.map((entry) => entry.tag.name));
    }

    public getStorageTotals(): { matchCount: number; totalSizeBytes: number } {
        const matchCount = this.db
            .select({ count: count() })
            .from(schema.replays)
            .get()?.count ?? 0;
        const totalSizeBytes = this.db
            .select({ total: sum(schema.file_storage.size_bytes).mapWith(Number) })
            .from(schema.file_storage)
            .get()?.total ?? 0;
        return { matchCount, totalSizeBytes };
    }

    public getStoredFileRecord(matchId: string): StoredFileRecords | undefined {
        return this.getStoredFileRecords([matchId]).get(matchId);
    }

    public getStoredFileRecords(matchIds: string[]): Map<string, StoredFileRecords> {
        const result = new Map<string, StoredFileRecords>();
        if (matchIds.length === 0) {
            return result;
        }

        const replayFile = alias(schema.file_storage, 'replay_file');
        const metadataFile = alias(schema.file_storage, 'metadata_file');

        const rows = this.db
            .select({
                uuid: schema.replays.uuid,
                replay: replayFile,
                metadata: metadataFile,
            })
            .from(schema.replays)
            .leftJoin(replayFile, eq(replayFile.uuid, schema.replays.replay_file_uuid))
            .leftJoin(metadataFile, eq(metadataFile.uuid, schema.replays.metadata_file_uuid))
            .where(inArray(schema.replays.uuid, matchIds))
            .all();

        for (const row of rows) {
            result.set(row.uuid, {
                replay: row.replay ? this.toFileRecord(row.replay) : undefined,
                metadata: row.metadata ? this.toFileRecord(row.metadata) : undefined,
            });
        }

        return result;
    }

    public deleteOrphanFileStorageRows(): number {
        const referenced = this.db
            .select({ uuid: schema.replays.replay_file_uuid })
            .from(schema.replays)
            .where(isNotNull(schema.replays.replay_file_uuid))
            .union(
                this.db
                    .select({ uuid: schema.replays.metadata_file_uuid })
                    .from(schema.replays)
                    .where(isNotNull(schema.replays.metadata_file_uuid)),
            );

        const res = this.db
            .delete(schema.file_storage)
            .where(notInArray(schema.file_storage.uuid, referenced))
            .run();

        return res.changes;
    }

    public upsertReplay(
        matchId: string,
        files: StoredFileRecords,
        userMetadata: UserMetadataUpdate,
        importFlowId: ImportFlowId,
        downloaderIdentity: DownloaderIdentity | null = null,
    ): void {
        this.db.transaction((tx) => this.upsertReplayTx(tx, matchId, files, userMetadata, importFlowId, downloaderIdentity));
    }

    public syncTags(matchId: string, tagNames: string[]): void {
        this.db.transaction((tx) => this.syncTagsTx(tx, matchId, tagNames));
    }

    public upsertReplayWithTags(
        matchId: string,
        files: StoredFileRecords,
        userMetadata: UserMetadataUpdate,
        tagNames: string[],
        importFlowId: ImportFlowId,
        downloaderIdentity: DownloaderIdentity | null = null,
    ): void {
        this.db.transaction((tx) => {
            this.upsertReplayTx(tx, matchId, files, userMetadata, importFlowId, downloaderIdentity);
            this.syncTagsTx(tx, matchId, tagNames);
        });
    }

    private upsertReplayTx(
        tx: ReplayTx,
        matchId: string,
        files: StoredFileRecords,
        userMetadata: UserMetadataUpdate,
        importFlowId: ImportFlowId,
        downloaderIdentity: DownloaderIdentity | null,
    ): void {
        tx.insert(schema.replays)
            .values({
                uuid: matchId,
                import_flow_id: importFlowId,
                downloaded_at_s: downloaderIdentity?.downloadedAtS,
                downloader_puuid: downloaderIdentity?.downloaderPuuid,
            })
            .onConflictDoNothing()
            .run();

        const current = tx
            .select({
                replayFileUuid: schema.replays.replay_file_uuid,
                metadataFileUuid: schema.replays.metadata_file_uuid,
            })
            .from(schema.replays)
            .where(eq(schema.replays.uuid, matchId))
            .get()!;

        const upsertFile = (existingUuid: string | null | undefined, record: FileRecord): string => {
            if (existingUuid) {
                tx.update(schema.file_storage)
                    .set({
                        path: record.path,
                        size_bytes: record.sizeBytes,
                        mtime_s: record.mtimeS,
                        sha256: record.sha256,
                    })
                    .where(eq(schema.file_storage.uuid, existingUuid))
                    .run();
                return existingUuid;
            }

            const inserted = tx.insert(schema.file_storage)
                .values({
                    path: record.path,
                    size_bytes: record.sizeBytes,
                    mtime_s: record.mtimeS,
                    sha256: record.sha256,
                })
                .returning({ uuid: schema.file_storage.uuid })
                .get();
            return inserted.uuid;
        };

        const metadataFileUuid = files.metadata
            ? upsertFile(current.metadataFileUuid, files.metadata)
            : current.metadataFileUuid;
        const replayFileUuid = files.replay
            ? upsertFile(current.replayFileUuid, files.replay)
            : current.replayFileUuid;

        tx.update(schema.replays)
            .set({ metadata_file_uuid: metadataFileUuid, replay_file_uuid: replayFileUuid })
            .where(eq(schema.replays.uuid, matchId))
            .run();


        tx.insert(schema.replayCustomizableData)
            .values({ uuid: matchId, name: userMetadata.name, notes: userMetadata.notes })
            .onConflictDoNothing()
            .run();
    }

    public getUserMetadata(matchId: string): VersionedUserMetadata | undefined {
        const row = this.db
            .select()
            .from(schema.replayCustomizableData)
            .where(eq(schema.replayCustomizableData.uuid, matchId))
            .get();
        if (!row) {
            return undefined;
        }

        const tags = this.getTagsForReplays([matchId])[matchId] ?? [];
        return {
            name: row.name,
            notes: row.notes ?? null,
            tags: tags.map((entry) => entry.tag.name),
            version: row.version,
        };
    }

    public updateUserMetadata(
        matchId: string,
        expectedVersion: number,
        patch: UserMetadataPatchRecord,
    ): UserMetadataUpdateResult {
        const outcome = this.db.transaction((tx): UserMetadataUpdateResult | undefined => {
            const current = tx
                .select({ version: schema.replayCustomizableData.version })
                .from(schema.replayCustomizableData)
                .where(eq(schema.replayCustomizableData.uuid, matchId))
                .get();
            if (!current) {
                return { kind: 'not_found' };
            }
            if (current.version !== expectedVersion) {
                return { kind: 'version_mismatch', currentVersion: current.version };
            }

            tx.update(schema.replayCustomizableData)
                .set({
                    ...(patch.name !== undefined && { name: patch.name }),
                    ...(patch.notes !== undefined && { notes: patch.notes }),
                    version: current.version + 1,
                })
                .where(eq(schema.replayCustomizableData.uuid, matchId))
                .run();

            if (patch.tags !== undefined) {
                this.syncTagsTx(tx, matchId, patch.tags);
            }
            return undefined;
        });

        return outcome ?? { kind: 'updated', record: this.getUserMetadata(matchId)! };
    }

    private syncTagsTx(tx: ReplayTx, matchId: string, tagNames: string[]): void {
        const uniqueNames = Array.from(new Set(
            tagNames.map((name) => name.trim()).filter((name) => name.length > 0),
        ));

        const tagIds = uniqueNames.map((name) => {
            tx.insert(schema.tags)
                .values({ name })
                .onConflictDoNothing({ target: schema.tags.name })
                .run();
            return tx
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(eq(schema.tags.name, name))
                .get()!.id;
        });

        const existingLinks = tx
            .select({ tagId: schema.replay_tags.tag_id })
            .from(schema.replay_tags)
            .where(eq(schema.replay_tags.replay_uuid, matchId))
            .all();

        const existingIds = new Set(existingLinks.map((link) => link.tagId));
        const desiredIds = new Set(tagIds);

        const toInsert = tagIds.filter((id) => !existingIds.has(id));
        const toDelete = [...existingIds].filter((id) => !desiredIds.has(id));

        if (toInsert.length > 0) {
            tx.insert(schema.replay_tags)
                .values(toInsert.map((tag_id) => ({ replay_uuid: matchId, tag_id })))
                .run();
        }
        if (toDelete.length > 0) {
            tx.delete(schema.replay_tags)
                .where(and(
                    eq(schema.replay_tags.replay_uuid, matchId),
                    inArray(schema.replay_tags.tag_id, toDelete),
                ))
                .run();
        }
    }

    public getAppMeta(key: string): string | null {
        return this.db
            .select({ value: schema.app_meta.value })
            .from(schema.app_meta)
            .where(eq(schema.app_meta.key, key))
            .get()?.value ?? null;
    }

    public setAppMeta(key: string, value: string): void {
        this.db
            .insert(schema.app_meta)
            .values({ key, value })
            .onConflictDoUpdate({
                target: schema.app_meta.key,
                set: { value },
            })
            .run();
    }

    public seedDownloaderIdentity(matchId: string, identity: DownloaderIdentity): boolean {
        const res = this.db
            .update(schema.replays)
            .set({
                downloaded_at_s: identity.downloadedAtS,
                downloader_puuid: identity.downloaderPuuid,
            })
            .where(and(
                eq(schema.replays.uuid, matchId),
                isNull(schema.replays.downloader_puuid),
            ))
            .run();
        return res.changes > 0;
    }

    public clearAllData(): void {
        this.db.transaction((tx) => {
            tx.delete(schema.replay_tags).run();
            tx.delete(schema.file_storage).run();
            tx.delete(schema.replayCustomizableData).run();
            tx.delete(schema.replays).run();
            tx.delete(schema.tags).run();
            tx.delete(schema.app_meta).run();
        });
    }

    public deleteReplay(matchId: string): void {
        this.db.transaction((tx) => {
            const row = tx
                .select({
                    replayFileUuid: schema.replays.replay_file_uuid,
                    metadataFileUuid: schema.replays.metadata_file_uuid,
                })
                .from(schema.replays)
                .where(eq(schema.replays.uuid, matchId))
                .get();

            tx.delete(schema.replays).where(eq(schema.replays.uuid, matchId)).run();

            const fileUuids = [row?.replayFileUuid, row?.metadataFileUuid]
                .filter((uuid): uuid is string => !!uuid);
            if (fileUuids.length > 0) {
                tx.delete(schema.file_storage).where(inArray(schema.file_storage.uuid, fileUuids)).run();
            }
        });
    }
}
