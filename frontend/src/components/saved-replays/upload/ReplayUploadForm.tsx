import { type ChangeEvent, type DragEvent, type ReactNode, useRef, useState } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { cn } from '@/lib/utils';
import { useUploadReplay } from '@/lib/queries';
import type { ReplayImportRequest } from '@vrv/shared';

export interface ReplayUploadFormProps {
    /** File extension this form accepts, e.g. ".vrp". */
    extension: string;
    icon: typeof Upload;
    /** Builds the import request from the current form state; return null while required fields are incomplete. */
    buildRequest: () => ReplayImportRequest | null;
    /** Extra type-specific fields, rendered between the drop zone and the override checkbox. */
    children?: ReactNode;
    onUploaded: () => void;
}

/**
 * Shared drop-zone + override + submit UI for a single replay upload type.
 * Each concrete upload type (package/.vrp, raw replay/.vrf, Riot match/.json)
 * wraps this with its own extension, icon, and `buildRequest`.
 */
export function ReplayUploadForm({ extension, icon: Icon, buildRequest, children, onUploaded }: ReplayUploadFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [override, setOverride] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadReplay = useUploadReplay();

    const data = file ? buildRequest() : null;
    const canSubmit = !!file && !!data;

    function acceptFile(candidate: File | undefined) {
        if (!candidate) return;
        if (!candidate.name.toLowerCase().endsWith(extension)) {
            setFileError(`Expected a ${extension} file.`);
            return;
        }
        uploadReplay.reset();
        setFileError(null);
        setFile(candidate);
    }

    function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
        acceptFile(e.target.files?.[0]);
        e.target.value = '';
    }

    function handleDragOver(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(true);
    }

    function handleDragLeave() {
        setDragOver(false);
    }

    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(false);
        acceptFile(e.dataTransfer.files?.[0]);
    }

    function handleUpload() {
        if (!file || !data) return;
        uploadReplay.mutate({ file, data, override }, { onSuccess: onUploaded });
    }

    return (
        <>
            {/* Drop zone */}
            <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${extension} file`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors overflow-hidden',
                    dragOver
                        ? 'border-primary bg-primary/5'
                        : file
                            ? 'border-border bg-muted/30'
                            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/20',
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={extension}
                    className="hidden"
                    onChange={handleFileInputChange}
                />

                {file ? (
                    <>
                        <Icon className="size-7 text-muted-foreground" />
                        <p className="text-sm font-medium overflow-hidden">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
                        </p>
                    </>
                ) : (
                    <>
                        <Upload className="size-7 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Drop a <span className="font-medium text-foreground">{extension}</span> file here, or
                            click to browse
                        </p>
                    </>
                )}
            </div>

            {/* File type mismatch error */}
            {fileError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {fileError}
                </div>
            )}

            {children}

            {/* Override option */}
            <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                    checked={override}
                    onCheckedChange={(v) => setOverride(v === true)}
                />
                <div>
                    <p className="text-sm font-medium">Override if already exists</p>
                    <p className="text-xs text-muted-foreground">
                        Replace the stored replay if this match ID is already present.
                    </p>
                </div>
            </label>

            {/* Upload error */}
            {uploadReplay.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {uploadReplay.error?.message ?? 'Upload failed'}
                </div>
            )}

            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" disabled={uploadReplay.isPending}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button
                    onClick={handleUpload}
                    disabled={!canSubmit || uploadReplay.isPending}
                >
                    <Upload className={cn(uploadReplay.isPending && 'animate-pulse')} />
                    {uploadReplay.isPending ? 'Uploading…' : 'Upload'}
                </Button>
            </DialogFooter>
        </>
    );
}
