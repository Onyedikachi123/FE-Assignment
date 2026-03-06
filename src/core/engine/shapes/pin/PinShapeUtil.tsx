import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw';

export type TLPinShape = TLBaseShape<
    'pin',
    {
        w: number;
        h: number;
        text: string;
        color: string;
        attachedShapeIds: string[];
    }
>;

/**
 * PinShapeUtil
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class PinShapeUtil extends ShapeUtil<any> {
    static override type = 'pin' as const;

    override getDefaultProps(): TLPinShape['props'] {
        return { w: 32, h: 32, text: '', color: '#ef4444', attachedShapeIds: [] };
    }

    override getGeometry(shape: TLPinShape) {
        return new Rectangle2d({
            x: -16,
            y: -32,
            width: shape.props.w,
            height: shape.props.h,
            isFilled: true,
        });
    }

    override component(shape: TLPinShape) {
        const isSelected = this.editor.getOnlySelectedShapeId() === shape.id;

        const handleEscape = (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.editor.deselect(shape.id);
            }
        };

        return (
            <HTMLContainer id={shape.id}>
                <div
                    data-testid="pin-shape"
                    style={{
                        position: 'relative',
                        width: 32,
                        height: 32,
                        cursor: 'pointer',
                        transform: 'translate(-16px, -32px)',
                    }}
                >
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        {shape.props.attachedShapeIds.length > 1 && (
                            <circle cx="16" cy="10" r="14" stroke={shape.props.color} strokeWidth="2" strokeDasharray="4 2" />
                        )}
                        <path
                            d="M16 0C10.4772 0 6 4.47715 6 10C6 15.5228 16 32 16 32C16 32 26 15.5228 26 10C26 4.47715 21.5228 0 16 0ZM16 14C13.7909 14 12 12.2091 12 10C12 7.79086 13.7909 6 16 6C18.2091 6 20 7.79086 20 10C20 12.2091 18.2091 14 16 14Z"
                            fill={shape.props.color}
                        />
                    </svg>

                    {shape.props.attachedShapeIds.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: -10,
                            right: -10,
                            backgroundColor: shape.props.color,
                            color: 'white',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white',
                            fontWeight: 'bold'
                        }}>
                            {shape.props.attachedShapeIds.length}
                        </div>
                    )}

                    {isSelected && (
                        <div
                            style={{
                                position: 'absolute',
                                top: -48,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: 'white',
                                padding: '8px',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                width: '200px',
                                zIndex: 1000,
                            }}
                            onKeyDown={handleEscape}
                        >
                            <input
                                type="text"
                                value={shape.props.text}
                                onChange={(e) =>
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    this.editor.updateShape({ ...shape, props: { text: e.target.value } } as any)
                                }
                                placeholder="Add a note..."
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={shape.props.color}
                                    onChange={(e) =>
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        this.editor.updateShape({ ...shape, props: { color: e.target.value } } as any)
                                    }
                                    style={{ width: '24px', height: '24px', padding: 0, border: 'none' }}
                                />
                                <button
                                    onClick={() => this.editor.deleteShape(shape.id)}
                                    style={{
                                        backgroundColor: '#fee2e2',
                                        color: '#ef4444',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </HTMLContainer>
        );
    }

    override indicator() {
        return <circle cx={0} cy={-16} r={18} fill="none" />;
    }
}
