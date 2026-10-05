import { Injectable, Logger } from '@nestjs/common';

interface CachedAsset {
    buffer: Buffer;
    contentType: string;
}

const ALLOWED_HOSTS = new Set(['media.valorant-api.com', 'valorant-api.com']);

@Injectable()
export class StaticAssetProxyService {
    private readonly logger = new Logger(StaticAssetProxyService.name);
    private readonly cache = new Map<string, CachedAsset>();

    async fetch(rawUrl: string): Promise<CachedAsset> {
        const cached = this.cache.get(rawUrl);
        if (cached) {
            return cached;
        }

        let parsed: URL;
        try {
            parsed = new URL(rawUrl);
        } catch {
            throw new Error(`Invalid URL: ${rawUrl}`);
        }

        if (!ALLOWED_HOSTS.has(parsed.hostname)) {
            throw new Error(`Host not allowed: ${parsed.hostname}`);
        }

        const response = await fetch(rawUrl);
        if (!response.ok) {
            throw new Error(`Upstream returned ${response.status} for ${rawUrl}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const asset: CachedAsset = { buffer, contentType };
        this.cache.set(rawUrl, asset);
        return asset;
    }
}
