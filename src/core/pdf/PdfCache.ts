import { pdfWorkerManager } from './PdfWorkerManager';
import { Editor } from 'tldraw';

/**
 * PdfCacheManager
 *
 * Singleton LRU cache for rendered PDF page ImageBitmaps.
 * Cache key: `${pageIndex}_${scale.toFixed(2)}`
 * Max cached bitmaps: 20 (evicts oldest on overflow).
 *
 * zoom strategy: requestRender is idempotent (deduped by rendering Set).
 * invalidateAndRerender forces eviction + fresh render — used by the
 * debounced zoom handler to get sharp textures after zoom settles.
 */
export class PdfCacheManager {
    private static instance: PdfCacheManager;
    // LRU: Map insertion order is guaranteed by spec, oldest entry = first key.
    private cache = new Map<string, ImageBitmap>();
    private rendering = new Set<string>();
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

    /**
     * Returns a cached bitmap for the given page + scale.
     * Falls back to any available resolution for the page (best-effort).
     */
    public getCachedBitmap(pageIndex: number, scale: number): ImageBitmap | undefined {
        const key = this.getCacheKey(pageIndex, scale);
        const exact = this.cache.get(key);
        if (exact) {
            // Refresh LRU position
            this.cache.delete(key);
            this.cache.set(key, exact);
            return exact;
        }

        // Fallback: return any cached resolution for this page
        for (const [k, v] of this.cache.entries()) {
            if (k.startsWith(`${pageIndex}_`)) {
                return v;
            }
        }
        return undefined;
    }

    /**
     * Request an async render if not already cached or in-flight.
     * Safe to call on every render — idempotent.
     */
    public async requestRender(
        pageIndex: number,
        scale: number,
        targetDpr: number,
        editor: Editor,
        shapeId: string
    ): Promise<void> {
        const renderScale = scale * targetDpr;
        const key = this.getCacheKey(pageIndex, renderScale);
        if (this.cache.has(key) || this.rendering.has(key)) return;

        this.rendering.add(key);
        try {
            const bitmap = await pdfWorkerManager.renderPageToOffscreen(pageIndex, renderScale);
            this.cache.set(key, bitmap);

            // Surgically invalidate only this shape so tldraw repaints it
            const shape = editor.getShape(shapeId as any);
            if (shape) {
                editor.updateShape({ id: shapeId as any, type: 'pdf-page' as any });
            }
            this.evictStale();
        } catch (err) {
            console.error(`[PdfCache] Failed to render page ${pageIndex}:`, err);
        } finally {
            this.rendering.delete(key);
        }
    }

    /**
     * Used by the debounced zoom handler.
     * Evicts all resolutions for a page and fires a fresh render at the new scale.
     */
    public async invalidateAndRerender(
        pageIndex: number,
        scale: number,
        targetDpr: number,
        editor: Editor,
        shapeId: string
    ): Promise<void> {
        // Evict all cached resolutions for this page
        for (const key of Array.from(this.cache.keys())) {
            if (key.startsWith(`${pageIndex}_`)) {
                const bmp = this.cache.get(key);
                bmp?.close();
                this.cache.delete(key);
            }
        }
        // Also clear any in-flight renders for this page
        for (const key of Array.from(this.rendering)) {
            if (key.startsWith(`${pageIndex}_`)) {
                this.rendering.delete(key);
            }
        }
        // Now request a fresh high-quality render
        await this.requestRender(pageIndex, scale, targetDpr, editor, shapeId);
    }

    /**
     * Preloads high-resolution bitmaps for a set of page indices.
     * Used by CameraTool before export to ensure retina-quality textures.
     */
    public async preloadHighRes(pageIndices: number[], scale: number): Promise<void> {
        for (const index of pageIndices) {
            const key = this.getCacheKey(index, scale);
            if (!this.cache.has(key) && !this.rendering.has(key)) {
                this.rendering.add(key);
                try {
                    const bitmap = await pdfWorkerManager.renderPageToOffscreen(index, scale);
                    this.cache.set(key, bitmap);
                } catch (e) {
                    console.error('[PdfCache] Failed preloadHighRes for page', index, e);
                } finally {
                    this.rendering.delete(key);
                }
            }
        }
    }

    /** LRU eviction: remove oldest entries beyond MAX_CACHE_SIZE. */
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

    /** Full teardown — called when a new PDF is loaded. */
    public clearAll(): void {
        for (const bmp of this.cache.values()) {
            bmp.close();
        }
        this.cache.clear();
        this.rendering.clear();
    }
}

export const pdfCacheManager = PdfCacheManager.getInstance();
