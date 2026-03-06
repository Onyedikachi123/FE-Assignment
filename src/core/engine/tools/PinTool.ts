import { StateNode, TLPointerEventInfo, createShapeId, createBindingId, TLShape } from 'tldraw';
import { useAppStore } from '../../../state/useAppStore';

/**
 * PinTool
 */
export class PinTool extends StateNode {
    static override id = 'pin';

    override onPointerDown = (info: TLPointerEventInfo) => {
        const { point } = info;
        const { editor } = this;

        editor.markHistoryStoppingPoint('place-pin');

        const shapesAtPoint: TLShape[] = [];
        const sortedShapes = [...editor.getCurrentPageShapesSorted()].reverse();

        for (const shape of sortedShapes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((shape as any).type === 'pin' || (shape as any).type === 'capture-region') continue;

            const pageBounds = editor.getShapePageBounds(shape);
            if (!pageBounds) continue;

            if (pageBounds.containsPoint(point)) {
                shapesAtPoint.push(shape);
            }
        }

        const pinId = createShapeId();
        const attachedShapeIds = shapesAtPoint.length >= 2 ? shapesAtPoint.map(s => s.id) : [];

        editor.createShape({
            id: pinId,
            type: 'pin',
            x: point.x,
            y: point.y,
            props: {
                text: '',
                w: 32,
                h: 32,
                color: '#ef4444',
                attachedShapeIds
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        // If 2 or more shapes, we create the locking bindings
        if (shapesAtPoint.length >= 2) {
            for (const shape of shapesAtPoint) {
                const relativeOffset = {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    x: (shape as any).x - point.x,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    y: (shape as any).y - point.y,
                };

                editor.createBinding({
                    id: createBindingId(),
                    type: 'pin-attach',
                    fromId: pinId,
                    toId: shape.id,
                    props: {
                        relativeOffset,
                        pinShapeId: pinId,
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
            }
            useAppStore.getState().addToast(`Locked ${shapesAtPoint.length} shapes together.`, 'success');
        } else {
            useAppStore.getState().addToast('Place pin on overlapping shapes to lock.', 'info');
        }

        editor.setSelectedShapes([pinId]);
        editor.bringToFront([pinId]);
        editor.setCurrentTool('select');
    };
}
