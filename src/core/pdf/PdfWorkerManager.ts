import * as pdfjsLib from 'pdfjs-dist';

export interface PdfPageRawDims {
    pageIndex: number;
    width: number;
    height: number;
}

/**
 * PdfWorkerManager
 */
export class PdfWorkerManager {
    private static instance: PdfWorkerManager;
    private proxy: pdfjsLib.PDFDocumentProxy | null = null;
    private loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

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
        arrayBuffer: ArrayBuffer,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<{ numPages: number; pagesDims: PdfPageRawDims[] }> {
        // Destroy previous tasks
        if (this.loadingTask) {
            try { await this.loadingTask.destroy(); } catch { /* ignore */ }
            this.loadingTask = null;
        }
        if (this.proxy) {
            try { await this.proxy.destroy(); } catch { /* ignore */ }
            this.proxy = null;
        }

        const data = new Uint8Array(arrayBuffer);
        this.loadingTask = pdfjsLib.getDocument({ data });
        this.proxy = await this.loadingTask.promise;

        const currentProxy = this.proxy;
        const numPages = currentProxy.numPages;
        const pagesDims: PdfPageRawDims[] = [];

        for (let i = 1; i <= numPages; i++) {
            if (this.proxy !== currentProxy) break;

            const page = await currentProxy.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            pagesDims.push({ pageIndex: i, width: viewport.width, height: viewport.height });
            page.cleanup();

            if (onProgress) onProgress(i, numPages);
        }

        return { numPages, pagesDims };
    }

    public async renderPageToOffscreen(pageIndex: number, scale: number): Promise<ImageBitmap> {
        if (!this.proxy) throw new Error('[PdfWorkerManager] No PDF loaded');

        const page = await this.proxy.getPage(pageIndex);
        const viewport = page.getViewport({ scale });

        try {
            if (typeof OffscreenCanvas === 'undefined') {
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d')!;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await page.render({ canvasContext: context as any, viewport, canvas: canvas as any }).promise;
                return createImageBitmap(canvas);
            }

            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d')!;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await page.render({ canvasContext: context as any, viewport, canvas: canvas as any }).promise;
            return canvas.transferToImageBitmap();
        } finally {
            page.cleanup();
        }
    }

    public destroy(): void {
        if (this.loadingTask) {
            try { this.loadingTask.destroy(); } catch { /* ignore */ }
            this.loadingTask = null;
        }
        if (this.proxy) {
            try { this.proxy.destroy(); } catch { /* ignore */ }
            this.proxy = null;
        }
    }
}

export const pdfWorkerManager = PdfWorkerManager.getInstance();
