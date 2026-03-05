import * as pdfjsLib from 'pdfjs-dist';

export interface PdfPageRawDims {
    pageIndex: number;
    width: number;
    height: number;
}

/**
 * PdfWorkerManager
 *
 * Singleton that owns the pdf.js document proxy.
 * Guarantees the previous document is destroyed before a new one loads
 * to prevent orphaned worker memory.
 *
 * page.cleanup() is called after every render to release internal
 * pdf.js resources (operator lists, display lists) that accumulate
 * silently and cause memory bloat on long sessions.
 */
export class PdfWorkerManager {
    private static instance: PdfWorkerManager;
    private proxy: pdfjsLib.PDFDocumentProxy | null = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }
    }

    public static getInstance(): PdfWorkerManager {
        if (!PdfWorkerManager.instance) {
            PdfWorkerManager.instance = new PdfWorkerManager();
        }
        return PdfWorkerManager.instance;
    }

    public isLoaded(): boolean {
        return this.proxy !== null;
    }

    public async loadDocument(
        arrayBuffer: ArrayBuffer
    ): Promise<{ numPages: number; pagesDims: PdfPageRawDims[] }> {
        // Destroy previous document to prevent worker memory leak
        if (this.proxy) {
            await this.proxy.destroy();
            this.proxy = null;
        }

        const data = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data });
        this.proxy = await loadingTask.promise;

        const numPages = this.proxy.numPages;
        const pagesDims: PdfPageRawDims[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await this.proxy.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            pagesDims.push({ pageIndex: i, width: viewport.width, height: viewport.height });
            page.cleanup(); // Release internal operator list / display list resources
        }

        return { numPages, pagesDims };
    }

    /**
     * Renders a PDF page to an ImageBitmap using OffscreenCanvas.
     * Returns the bitmap with ownership transferred (zero-copy).
     * Calls page.cleanup() after render to prevent resource accumulation.
     */
    public async renderPageToOffscreen(pageIndex: number, scale: number): Promise<ImageBitmap> {
        if (!this.proxy) throw new Error('[PdfWorkerManager] No PDF loaded');

        const page = await this.proxy.getPage(pageIndex);
        const viewport = page.getViewport({ scale });

        try {
            if (typeof OffscreenCanvas === 'undefined') {
                // Safari / older browser fallback
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d')!;
                await page.render({ canvasContext: context as any, viewport, canvas: canvas as any }).promise;
                return createImageBitmap(canvas);
            }

            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d')!;
            await page.render({ canvasContext: context as any, viewport, canvas: canvas as any }).promise;
            return canvas.transferToImageBitmap();
        } finally {
            // CRITICAL: release pdf.js internal render resources
            page.cleanup();
        }
    }

    public destroy(): void {
        this.proxy?.destroy();
        this.proxy = null;
    }
}

export const pdfWorkerManager = PdfWorkerManager.getInstance();
