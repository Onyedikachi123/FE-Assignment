import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw';

export type TLPinShape = TLBaseShape<
    'pin',
    {
        w: number;
        h: number;
        text: string;
        color: string;
    }
>;

/**
 * PinShapeUtil
 *
 * Renders as an SVG map pin (teardrop + inner dot).
 * Transform offsets the container so the pin TIP is at the shape's (x, y).
 *
 * When selected: shows an inline comment popover with autoFocus textarea.
 * Escape key: deselects the pin and closes the popover.
 * z-index: managed externally (PinTool calls editor.bringToFront after creation).
 */
export class PinShapeUtil extends ShapeUtil<any> {
    static override type = 'pin' as const;

    override getDefaultProps(): TLPinShape['props'] {
        return { w: 32, h: 32, text: '', color: '#ef4444' };
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
                    {/* Pin SVG Icon */}
                    <svg
                        viewBox="0 0 24 24"
                        fill={shape.props.color}
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ width: 32, height: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                    >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" fill="white" />
                    </svg>

                    {/* Comment Popover — shown only when pin is selected */}
                    {isSelected && (
                        <div
                            data-testid="pin-popover"
                            style={{
                                position: 'absolute',
                                bottom: 44,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                padding: 12,
                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                width: 240,
                                zIndex: 9999,
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            {/* Caret arrow */}
                            <div style={{
                                position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                                width: 14, height: 7, overflow: 'hidden',
                            }}>
                                <div style={{ width: 10, height: 10, background: 'white', border: '1px solid #e2e8f0', transform: 'rotate(45deg) translate(2px, -6px)' }} />
                            </div>

                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                                Annotation
                            </label>
                            <textarea
                                data-testid="pin-comment-input"
                                onPointerDown={(e) => e.stopPropagation()}
                                onKeyDown={handleEscape}
                                value={shape.props.text}
                                onChange={(e) =>
                                    this.editor.updateShape({ id: shape.id, type: 'pin' as any, props: { text: e.target.value } })
                                }
                                placeholder="Leave a comment…"
                                style={{
                                    width: '100%', height: 72, border: '1px solid #e2e8f0', borderRadius: 8,
                                    resize: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit',
                                    padding: '8px 10px', color: '#1e293b', boxSizing: 'border-box',
                                    lineHeight: 1.5, transition: 'border-color 0.15s',
                                }}
                                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); this.editor.deselect(shape.id); }}
                                    style={{
                                        flex: 1, background: '#6366f1', color: 'white', padding: '7px 12px',
                                        borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                                        fontSize: 13, transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#4f46e5'; }}
                                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#6366f1'; }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        this.editor.deleteShapes([shape.id]);
                                    }}
                                    style={{
                                        padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                                        cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'white',
                                        color: '#64748b',
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

    override indicator(shape: TLPinShape) {
        return <circle cx={0} cy={-16} r={18} fill="none" />;
    }
}
