import { pdfWorkerManager } from './PdfWorkerManager';
import { Editor, TLShapeId } from 'tldraw';

/**
 * PdfCacheManager
 */
export class PdfCacheManager {
    private static instance: PdfCacheManager;
    private cache = new Map<string, ImageBitmap>();
    private rendering = new Map<string, Promise<ImageBitmap>>();
    private static readonly MAX_CACHE_SIZE = 20;

    private constructor() { }

    public static getInstance(): PdfCacheManager {
        if (!PdfCacheManager.instance) {
            PdfCacheManager.instance = new PdfCacheManager();
        }
        return PdfCacheManager.instance;
    }

    public getCacheKey(pageIndex: number, scale: number): string {
        return `${pageIndex}_${scale.toFixed(2)}`;
    }

    public getCachedBitmap(pageIndex: number, scale: number): ImageBitmap | undefined {
        const key = this.getCacheKey(pageIndex, scale);
        const exact = this.cache.get(key);
        if (exact) {
            this.cache.delete(key);
            this.cache.set(key, exact);
            return exact;
        }

        for (const [k, v] of this.cache.entries()) {
            if (k.startsWith(`${pageIndex}_`)) {
                return v;
            }
        }
        return undefined;
    }

    public async requestRender(
        pageIndex: number,
        scale: number,
        targetDpr: number,
        editor: Editor,
        shapeId: TLShapeId
    ): Promise<void> {
        if (!pdfWorkerManager.isLoaded()) return;

        const renderScale = scale * targetDpr;
        const key = this.getCacheKey(pageIndex, renderScale);
        if (this.cache.has(key) || this.rendering.has(key)) return;

        const promise = pdfWorkerManager.renderPageToOffscreen(pageIndex, renderScale);
        this.rendering.set(key, promise);

        try {
            const bitmap = await promise;
            this.cache.set(key, bitmap);

            const shape = editor.getShape(shapeId);
            if (shape) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                editor.updateShape({ id: shapeId, type: 'pdf-page' } as any);
            }
            this.evictStale();
        } catch (err) {
            console.error(`[PdfCache] Failed to render page ${pageIndex}:`, err);
        } finally {
            this.rendering.delete(key);
        }
    }

    public async waitForHighRes(pageIndex: number, scale: number): Promise<ImageBitmap | undefined> {
        const key = this.getCacheKey(pageIndex, scale);
        const inFlight = this.rendering.get(key);
        if (inFlight) {
            try {
                return await inFlight;
            } catch {
                return undefined;
            }
        }
        return this.getCachedBitmap(pageIndex, scale);
    }

    public async invalidateAndRerender(
        pageIndex: number,
        scale: number,
        targetDpr: number,
        editor: Editor,
        shapeId: TLShapeId
    ): Promise<void> {
        for (const key of Array.from(this.cache.keys())) {
            if (key.startsWith(`${pageIndex}_`)) {
                const bmp = this.cache.get(key);
                bmp?.close();
                this.cache.delete(key);
            }
        }
        for (const key of Array.from(this.rendering.keys())) {
            if (key.startsWith(`${pageIndex}_`)) {
                this.rendering.delete(key);
            }
        }
        await this.requestRender(pageIndex, scale, targetDpr, editor, shapeId);
    }

    public async preloadHighRes(pageIndices: number[], scale: number): Promise<void> {
        if (!pdfWorkerManager.isLoaded()) return;

        const promises: Promise<void>[] = [];

        for (const index of pageIndices) {
            const key = this.getCacheKey(index, scale);
            if (!this.cache.has(key) && !this.rendering.has(key)) {
                const renderPromise = pdfWorkerManager.renderPageToOffscreen(index, scale);
                this.rendering.set(key, renderPromise);
                promises.push(
                    renderPromise
                        .then((bitmap) => {
                            this.cache.set(key, bitmap);
                        })
                        .catch((e) => {
                            console.error('[PdfCache] Failed preloadHighRes for page', index, e);
                        })
                        .finally(() => {
                            this.rendering.delete(key);
                        })
                );
            } else if (this.rendering.has(key)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                promises.push(this.rendering.get(key)!.catch(() => { }) as any);
            }
        }
        await Promise.allSettled(promises);
    }

    private evictStale(): void {
        if (this.cache.size > PdfCacheManager.MAX_CACHE_SIZE) {
            const overflow = this.cache.size - PdfCacheManager.MAX_CACHE_SIZE;
            let count = 0;
            for (const [k, bmp] of this.cache.entries()) {
                if (count >= overflow) break;
                bmp.close();
                this.cache.delete(k);
                count++;
            }
        }
    }

    public clearAll(): void {
        for (const bmp of this.cache.values()) {
            bmp.close();
        }
        this.cache.clear();
        this.rendering.clear();
    }
}

export const pdfCacheManager = PdfCacheManager.getInstance();
