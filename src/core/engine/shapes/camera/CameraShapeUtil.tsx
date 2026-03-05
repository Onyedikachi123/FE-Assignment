import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape, toDomPrecision } from 'tldraw';

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
    override canResize() { return false; }
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

        return (
            <HTMLContainer id={shape.id}>
                <div
                    data-testid="camera-crop-overlay"
                    style={{
                        width: w,
                        height: h,
                        border: '1.5px solid #1e293b', // Professional slate border
                        background: 'transparent',
                        borderRadius: '8px', // Rounded rectangle parity with demo
                        // Create a "spotlight" effect by dimming everything outside the crop
                        boxShadow: '0 0 0 10000px rgba(15, 23, 42, 0.4)',
                        pointerEvents: 'none',
                        transition: 'box-shadow 0.2s ease',
                    }}
                >
                    {/* Interior "safe area" highlight */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6.5px',
                    }} />
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
