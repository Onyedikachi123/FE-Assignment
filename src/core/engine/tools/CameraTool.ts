import { StateNode, TLPointerEventInfo, Box, createShapeId } from 'tldraw';
import { pdfCacheManager } from '../../pdf/PdfCache';
import { useAppStore } from '../../../state/useAppStore';

/**
 * CameraTool
 *
 * Improvements over the initial implementation:
 * 1. FLOATING ACTION BAR — instead of exporting immediately on pointer-up,
 *    the crop box remains on canvas. A React component (CameraActionBar)
 *    reads crop bounds from Zustand and shows Copy / Save PNG / Cancel.
 *
 * 2. DARKROOM EFFECT — an SVG overlay dims everything outside the crop region.
 *
 * 3. SHIFT-KEY ASPECT RATIO LOCK — holding Shift constrains w === h (1:1 square).
 *
 * 4. COPY TO CLIPBOARD — CameraActionBar exposes navigator.clipboard.write().
 *
 * 5. EMPTY CROP GUARD — if 0 intersecting shapes, Cancel is the only valid action.
 */
export class CameraTool extends StateNode {
    static override id = 'camera';

    private isDrawing = false;
    private startPoint = { x: 0, y: 0 };
    private cropShapeId = createShapeId();

    override onPointerDown = (info: TLPointerEventInfo) => {
        this.isDrawing = true;
        this.startPoint = { x: info.point.x, y: info.point.y };
        this.cropShapeId = createShapeId();

        this.editor.createShape({
            id: this.cropShapeId,
            type: 'geo',
            x: this.startPoint.x,
            y: this.startPoint.y,
            props: { w: 1, h: 1, geo: 'rectangle', fill: 'semi', color: 'blue', dash: 'dashed' },
        });
    };

    override onPointerMove = (info: TLPointerEventInfo) => {
        if (!this.isDrawing) return;
        const { point, shiftKey } = info;

        let rawW = point.x - this.startPoint.x;
        let rawH = point.y - this.startPoint.y;

        // Shift-key: lock to 1:1 square
        if (shiftKey) {
            const side = Math.min(Math.abs(rawW), Math.abs(rawH));
            rawW = Math.sign(rawW) * side;
            rawH = Math.sign(rawH) * side;
        }

        const w = Math.abs(rawW);
        const h = Math.abs(rawH);
        const x = rawW < 0 ? point.x + (shiftKey ? rawW : rawW) : this.startPoint.x;
        const y = rawH < 0 ? point.y + (shiftKey ? rawH : rawH) : this.startPoint.y;

        this.editor.updateShape({
            id: this.cropShapeId,
            type: 'geo',
            x: Math.min(point.x, this.startPoint.x),
            y: Math.min(point.y, this.startPoint.y),
            props: { w, h },
        });
    };

    override onPointerUp = (info: TLPointerEventInfo) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const cropShape = this.editor.getShape(this.cropShapeId);
        if (!cropShape) return;

        const bounds = new Box(
            cropShape.x,
            cropShape.y,
            (cropShape.props as any).w,
            (cropShape.props as any).h
        );

        // Too small to be useful — clean up
        if (bounds.w < 10 || bounds.h < 10) {
            this.editor.deleteShape(this.cropShapeId);
            return;
        }

        // Expose the crop box bounds to the React layer via Zustand
        // This triggers the CameraActionBar to appear
        useAppStore.getState().setCropBox(
            { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            this.cropShapeId
        );

        // Stay in camera tool until user acts on the action bar
    };

    override onKeyDown = (info: { key: string }) => {
        if (info.key === 'Escape') {
            this.cancelCrop();
        }
    };

    private cancelCrop() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.editor.deleteShape(this.cropShapeId);
        }
        useAppStore.getState().setCropBox(null, null);
        this.editor.setCurrentTool('select');
    }
}

/**
 * executeCropExport
 *
 * Headless offscreen export pipeline. Called by CameraActionBar when user
 * clicks "Save PNG" or "Copy".
 *
 * Steps:
 * A. Spatial query — find shapes intersecting crop bounds
 * B. Preload high-res PDF textures for captured pages
 * C. Serialise via editor.getSvgString (tldraw native, vector-accurate)
 * D. Rasterise to 2× canvas for retina quality
 * E. Stream Blob to download URL or Clipboard API
 */
export async function executeCropExport(
    editor: any,
    bounds: { x: number; y: number; w: number; h: number },
    target: 'download' | 'clipboard' = 'download'
): Promise<void> {
    const cropBounds = new Box(bounds.x, bounds.y, bounds.w, bounds.h);

    const intersectingShapeIds = editor
        .getCurrentPageShapesSorted()
        .filter((shape: any) => {
            const geo = editor.getShapeGeometry(shape);
            const shapeBounds = new Box(shape.x, shape.y, geo.bounds.w, geo.bounds.h);
            return shapeBounds.collides(cropBounds) || cropBounds.includes(shapeBounds);
        })
        .map((s: any) => s.id);

    // Preload high-res textures for any PDF pages in the crop
    const pdfPageIndices = intersectingShapeIds
        .map((id: string) => {
            const s = editor.getShape(id) as any;
            return s?.type === 'pdf-page' ? s.props.pageIndex : null;
        })
        .filter(Boolean) as number[];

    if (pdfPageIndices.length > 0) {
        await pdfCacheManager.preloadHighRes(pdfPageIndices, 2);
    }

    const svg = await editor.getSvgString(
        intersectingShapeIds.length > 0 ? intersectingShapeIds : undefined,
        { scale: 2, background: true, bounds: cropBounds }
    );

    if (!svg) throw new Error('[CameraTool] SVG serialisation returned null');

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.svg);
    });

    const canvas = document.createElement('canvas');
    canvas.width = bounds.w * 2;
    canvas.height = bounds.h * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('Blob conversion failed')); return; }

            if (target === 'clipboard') {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                } catch (e) {
                    console.error('[CameraTool] Clipboard write failed:', e);
                }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `canvas-export-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
            resolve();
        }, 'image/png');
    });
}
