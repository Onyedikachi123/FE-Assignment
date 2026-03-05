import { Box, Editor } from 'tldraw';
import { pdfCacheManager } from '../../pdf/PdfCache';
import { useAppStore } from '../../../state/useAppStore';

/**
 * executeCropExport
 * - High-resolution export utility (Strictly API-based)
 * - Guarantees 0% UI pollution
 */
export async function executeCropExport(
    editor: Editor,
    bounds: { x: number; y: number; w: number; h: number },
    target: 'download' | 'clipboard' = 'download'
): Promise<void> {
    const cropBounds = new Box(bounds.x, bounds.y, bounds.w, bounds.h);

    // Identify shapes within the region.
    // We sort by depth to maintain visual stack integrity in export
    const intersectingShapeIds = editor
        .getCurrentPageShapesSorted()
        .filter((shape) => {
            const geo = editor.getShapeGeometry(shape);
            const shapeBounds = new Box(shape.x, shape.y, geo.bounds.w, geo.bounds.h);
            return shapeBounds.collides(cropBounds) || cropBounds.includes(shapeBounds);
        })
        .map((s) => s.id);

    // Filter PDF pages to force high-res cache hydration
    const pdfPageIndices = intersectingShapeIds
        .map((id) => {
            const s = editor.getShape(id) as unknown as { type: string, props: { pageIndex: number } };
            return s?.type === 'pdf-page' ? s.props.pageIndex : null;
        })
        .filter((idx): idx is number => idx !== null);

    if (pdfPageIndices.length > 0) {
        await pdfCacheManager.preloadHighRes(pdfPageIndices, 2);
    }

    // Capture standard high-res serialization from tldraw.
    // Scale 2 ensures sharpness on Retina/4K displays.
    const svgResult = await editor.getSvgString(
        intersectingShapeIds.length > 0 ? intersectingShapeIds : Array.from(editor.getCurrentPageShapeIds()),
        {
            scale: 2,
            background: true,
            bounds: cropBounds,
            padding: 0
        }
    );

    if (!svgResult || !svgResult.svg) {
        throw new Error('[CameraTool] SVG serialization failed');
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Safety for external assets
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgResult.svg);
    });

    const canvas = document.createElement('canvas');
    canvas.width = bounds.w * 2;
    canvas.height = bounds.h * 2;
    const ctx = canvas.getContext('2d', { alpha: false }); // Opt for better performance
    if (!ctx) throw new Error('[CameraTool] Failed to acquire 2D context');

    // Draw pure background as requested - no transparency artifacts
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const filename = `camera-crop-${Date.now()}.png`;

    await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('Export blob conversion failed')); return; }

            if (target === 'clipboard') {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    useAppStore.getState().addToast('Copied to clipboard', 'success');
                } catch (e) {
                    console.error('[CameraTool] Clipboard write failed:', e);
                    useAppStore.getState().addToast('Clipboard write restricted', 'error');
                }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();

                // Cleanup to prevent memory leaks in long-running sessions
                setTimeout(() => URL.revokeObjectURL(url), 100);
                useAppStore.getState().addToast(`Exported: ${filename}`, 'success');
            }
            resolve();
        }, 'image/png', 1.0);
    });
}
