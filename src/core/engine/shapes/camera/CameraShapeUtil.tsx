import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape, toDomPrecision } from 'tldraw';
import { executeCropExport } from '../../tools/CameraExport';

export type TLCameraShape = TLBaseShape<
    'camera',
    {
        w: number;
        h: number;
    }
>;

/**
 * CameraShapeUtil
 * Staff-level implementation for the crop overlay.
 * - Perfectly rounded corners (8px)
 * - Clear, high-contrast border
 * - Dimmed backdrop via CSS shadow
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CameraShapeUtil extends ShapeUtil<any> {
    static override type = 'camera' as const;

    override getDefaultProps(): { w: number; h: number } {
        return { w: 100, h: 100 };
    }

    override canBind() { return false; }
    override canEdit() { return false; }
    override canResize() { return true; }
    canRotate() { return false; }

    override getGeometry(shape: TLCameraShape) {
        return new Rectangle2d({
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    override component(shape: TLCameraShape) {
        const { w, h } = shape.props;
        const editor = this.editor;
        const isSelected = editor.getOnlySelectedShapeId() === shape.id;

        const handleExport = async (e: React.MouseEvent) => {
            e.stopPropagation();
            try {
                const { x, y } = shape;
                const { w, h } = shape.props;
                await executeCropExport(editor, { x, y, w, h }, 'download');
            } catch (err) {
                console.error('[CameraShape] Export failed:', err);
            }
        };

        const handleDiscard = (e: React.MouseEvent) => {
            e.stopPropagation();
            editor.deleteShape(shape.id);
        };

        return (
            <HTMLContainer id={shape.id}>
                <div
                    data-testid="camera-crop-overlay"
                    style={{
                        width: w,
                        height: h,
                        border: '2px solid #6366f1',
                        background: 'rgba(99, 102, 241, 0.05)',
                        borderRadius: '0px',
                        boxShadow: isSelected ? '0 0 0 10000px rgba(15, 23, 42, 0.4)' : 'none',
                        pointerEvents: 'all',
                        transition: 'box-shadow 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                    }}
                >
                    {isSelected && (
                        <div style={{
                            position: 'absolute',
                            bottom: -50,
                            display: 'flex',
                            gap: 8,
                            background: 'white',
                            padding: '6px 12px',
                            borderRadius: 12,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            pointerEvents: 'all',
                            zIndex: 1000
                        }}>
                            <button
                                onClick={handleExport}
                                style={{
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Export PNG
                            </button>
                            <button
                                onClick={handleDiscard}
                                style={{
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Discard
                            </button>
                        </div>
                    )}
                </div>
            </HTMLContainer>
        );
    }

    override indicator(shape: TLCameraShape) {
        return (
            <rect
                width={toDomPrecision(shape.props.w)}
                height={toDomPrecision(shape.props.h)}
                rx="8"
                ry="8"
            />
        );
    }

    toSvgElement(): SVGElement | null {
        // Crucial: The crop UI stays in the editor only. Never appears in export.
        return null;
    }
}
