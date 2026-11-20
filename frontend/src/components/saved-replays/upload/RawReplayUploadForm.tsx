import { FileVideo } from 'lucide-react';
import { ReplayUploadForm } from '@/components/saved-replays/upload/ReplayUploadForm.tsx';
import { ReplayFileTypeSchema, type ReplayImportRequest } from '@vrv/shared';

export function RawReplayUploadForm({ onUploaded }: { onUploaded: () => void }) {
    return (
        <ReplayUploadForm
            extension=".vrf"
            icon={FileVideo}
            buildRequest={(): ReplayImportRequest => ({ type: ReplayFileTypeSchema.enum.replayFile })}
            onUploaded={onUploaded}
        />
    );
}
