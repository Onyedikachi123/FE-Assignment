import { BaseBoxShapeUtil, HTMLContainer, TLBaseShape, toDomPrecision } from 'tldraw';
import { pdfCacheManager } from '../../../pdf/PdfCache';
import { pdfWorkerManager } from '../../../pdf/PdfWorkerManager';

export type TLPdfPageShape = TLBaseShape<
    'pdf-page',
    {
        w: number;
        h: number;
        pageIndex: number;
        error?: boolean;
    }
>;

/**
 * PdfPageShapeUtil
 *
 * CRITICAL ADDITIONS:
 * 1. toSvgElement() — enables Camera Tool export to capture PDF pages.
 *    Encodes the cached ImageBitmap as a base64 PNG embedded in an SVG <image>.
 *
 * 2. Viewport virtualisation — only requests renders for shapes that are
 *    currently visible in the tldraw camera viewport. Off-screen pages stay
 *    as skeletons, preventing simultaneous mass renders on large documents.
 *
 * 3. Error state — renders a styled error box for corrupted pages instead
 *    of crashing the entire canvas.
 *
 * 4. Retina-aware canvas ref — draws the bitmap imperatively without state.
 */
export class PdfPageShapeUtil extends BaseBoxShapeUtil<any> {
    static override type = 'pdf-page' as const;

    override getDefaultProps(): TLPdfPageShape['props'] {
        return { w: 595, h: 842, pageIndex: 1, error: false }; // A4 default dimensions
    }

    override component(shape: any) {
        const { w, h, pageIndex, error } = shape.props;
        const editor = this.editor;

        if (error) {
            return (
                <HTMLContainer id={shape.id}>
                    <div
                        style={{
                            width: w, height: h,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            border: '2px dashed #ef4444', borderRadius: 8,
                            background: '#fef2f2', color: '#ef4444', gap: 8,
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Failed to render page {pageIndex}</span>
                    </div>
                </HTMLContainer>
            );
        }

        const dpr = editor.getInstanceState().devicePixelRatio;
        const scale = editor.getCamera().z;
        const renderScale = scale * dpr;

        // --- Viewport virtualisation: only request render for visible pages ---
        const viewportBounds = editor.getViewportPageBounds();
        const shapeBounds = editor.getShapePageBounds(shape);
        const isInViewport = shapeBounds ? viewportBounds.collides(shapeBounds) : false;

        const bitmap = pdfCacheManager.getCachedBitmap(pageIndex, renderScale);
        const isPdfLoaded = pdfWorkerManager.isLoaded();

        if (!bitmap && isInViewport && isPdfLoaded) {
            // Fire-and-forget: cache manager will call updateShape when done
            pdfCacheManager.requestRender(pageIndex, scale, dpr, editor, shape.id).catch(() => {
                // Mark this shape as errored so users get visual feedback
                editor.updateShape({ id: shape.id, type: 'pdf-page' as any, props: { ...shape.props, error: true } });
            });
        }

        return (
            <HTMLContainer id={shape.id}>
                <div
                    data-testid={`pdf-page-${pageIndex}`}
                    style={{
                        width: w, height: h, position: 'relative', overflow: 'hidden',
                        backgroundColor: '#f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        borderRadius: 2,
                    }}
                >
                    {!bitmap && (
                        <div
                            style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 12, color: '#94a3b8',
                            }}
                        >
                            {/* Animated skeleton shimmer */}
                            <div style={{ width: '80%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                            <div style={{ width: '60%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite 0.2s' }} />
                            <span style={{ fontSize: 13, marginTop: 8 }}>
                                {isInViewport ? `Rendering page ${pageIndex}…` : `Page ${pageIndex}`}
                            </span>
                        </div>
                    )}
                    <canvas
                        data-testid={`pdf-canvas-${pageIndex}`}
                        width={bitmap ? bitmap.width : 0}
                        height={bitmap ? bitmap.height : 0}
                        style={{ width: '100%', height: '100%', display: bitmap ? 'block' : 'none' }}
                        ref={(canvas) => {
                            if (!canvas || !bitmap) return;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                ctx.drawImage(bitmap, 0, 0);
                            }
                        }}
                    />
                </div>
            </HTMLContainer>
        );
    }

    /**
     * toSvgElement() — CRITICAL for Camera Tool export.
     *
     * tldraw's getSvgString() serialises shapes via SVG. HTMLContainer-based
     * shapes return nothing by default, producing blank rectangles in exports.
     *
     * We override this to encode the cached ImageBitmap as a base64 PNG
     * and embed it as an SVG <image> element — giving the Camera Tool a
     * pixel-perfect, retina-quality representation of the PDF page.
     */
    async toSvgElement(shape: any): Promise<SVGElement | null> {
        const { w, h, pageIndex } = shape.props;

        // Try to get a high-res bitmap at 2× scale for export quality
        const bitmap =
            pdfCacheManager.getCachedBitmap(pageIndex, 2) ??
            pdfCacheManager.getCachedBitmap(pageIndex, 1);

        if (!bitmap) {
            // Render a placeholder rect if no bitmap is available
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', String(toDomPrecision(w)));
            rect.setAttribute('height', String(toDomPrecision(h)));
            rect.setAttribute('fill', '#f1f5f9');
            return rect;
        }

        // Draw bitmap to an offscreen canvas, extract as base64 PNG
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0);

        const dataUrl = canvas.toDataURL('image/png');
        const imageEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imageEl.setAttribute('href', dataUrl);
        imageEl.setAttribute('width', String(toDomPrecision(w)));
        imageEl.setAttribute('height', String(toDomPrecision(h)));
        imageEl.setAttribute('preserveAspectRatio', 'none');
        return imageEl;
    }

    override indicator(shape: any) {
        return <rect width={shape.props.w} height={shape.props.h} fill="none" rx="2" ry="2" />;
    }
}
