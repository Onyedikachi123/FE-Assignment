import { StateNode, TLPointerEventInfo, createShapeId, createBindingId, TLShape } from 'tldraw';

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
            if ((shape as any).type === 'pin') continue;

            const pageBounds = editor.getShapePageBounds(shape);
            if (!pageBounds) continue;

            if (pageBounds.containsPoint(point)) {
                shapesAtPoint.push(shape);
                if (shapesAtPoint.length >= 2) break;
            }
        }

        const pinId = createShapeId();
        editor.createShape({
            id: pinId,
            type: 'pin',
            x: point.x,
            y: point.y,
            props: { text: '', w: 32, h: 32, color: '#ef4444' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        if (shapesAtPoint.length >= 2) {
            const shapeA = shapesAtPoint[0];
            const shapeB = shapesAtPoint[1];

            const relativeOffset = {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                x: (shapeA as any).x - (shapeB as any).x,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                y: (shapeA as any).y - (shapeB as any).y,
            };

            editor.createBinding({
                id: createBindingId(),
                type: 'pin-attach',
                fromId: shapeA.id,
                toId: shapeB.id,
                props: {
                    relativeOffset,
                    pinShapeId: pinId,
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        }

        editor.setSelectedShapes([pinId]);
        editor.bringToFront([pinId]);
        editor.setCurrentTool('select');
    };
}
