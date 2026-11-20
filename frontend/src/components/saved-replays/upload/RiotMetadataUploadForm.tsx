import { FileJson } from 'lucide-react';
import { ReplayUploadForm } from '@/components/saved-replays/upload/ReplayUploadForm.tsx';
import { ReplayFileTypeSchema, type ReplayImportRequest } from '@vrv/shared';

export function RiotMetadataUploadForm({ onUploaded }: { onUploaded: () => void }) {
    return (
        <ReplayUploadForm
            extension=".json"
            icon={FileJson}
            buildRequest={(): ReplayImportRequest => ({ type: ReplayFileTypeSchema.enum.riotMetadata })}
            onUploaded={onUploaded}
        />
    );
}
