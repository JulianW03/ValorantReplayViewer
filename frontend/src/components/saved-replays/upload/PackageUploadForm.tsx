import { FileArchive } from 'lucide-react';
import { ReplayUploadForm } from '@/components/saved-replays/upload/ReplayUploadForm.tsx';
import { ReplayFileTypeSchema, type ReplayImportRequest } from '@vrv/shared';

export function PackageUploadForm({ onUploaded }: { onUploaded: () => void }) {
    return (
        <ReplayUploadForm
            extension=".vrp"
            icon={FileArchive}
            buildRequest={(): ReplayImportRequest => ({ type: ReplayFileTypeSchema.enum.package })}
            onUploaded={onUploaded}
        />
    );
}
