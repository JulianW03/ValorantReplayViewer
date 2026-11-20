import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ImportFlowId } from '@vrv/shared';
import { file_storage } from './fileStorage.schema';

export const replays = sqliteTable(
    'replays',
    {
        uuid: text('uuid').primaryKey(),

        imported_at_s: integer('imported_at_s')
            .$defaultFn(() => Math.floor(Date.now() / 1000))
            .notNull(),

        import_flow_id: text('import_flow_id').$type<ImportFlowId>(),

        replay_file_uuid: text('replay_file_uuid')
            .references(() => file_storage.uuid, {
                onDelete: 'set null',
            }),

        metadata_file_uuid: text('metadata_file_uuid')
            .references(() => file_storage.uuid, {
                onDelete: 'set null',
            }),

        downloaded_at_s: integer('downloaded_at_s'),

        downloader_puuid: text('downloader_puuid'),
    },
    (table) => ({
        importedAtIdx: index('replays_imported_at_idx')
            .on(table.imported_at_s),
    }),
);