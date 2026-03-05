import { StateNode, TLPointerEventInfo, createShapeId, createBindingId } from 'tldraw';

/**
 * PinTool
 *
 * CRITICAL SPEC COMPLIANCE FIX:
 * The exercise spec says: "If the pin is on top of 2 overlapping shapes,
 * the 2 shapes are 'attached'. Moving one will move the other as well."
 *
 * The pin is a VISUAL MARKER that TRIGGERS a binding between the two
 * underlying shapes. The attachment is between ShapeA and ShapeB — not
 * between the Pin and a shape.
 *
 * Flow:
 * 1. Find all shapes at the click point (top 2 by z-order).
 * 2. Place the Pin shape visually.
 * 3. If 2+ shapes found, create a 'pin-attach' binding between them.
 * 4. Store the pinShapeId in the binding for future reference.
 */
export class PinTool extends StateNode {
    static override id = 'pin';

    override onPointerDown = (info: TLPointerEventInfo) => {
        const { point } = info;
        const { editor } = this;

        editor.markHistoryStoppingPoint('place-pin');

        // --- Step 1: Find the 2 topmost shapes at the click point ---
        const shapesAtPoint: any[] = [];
        const sortedShapes = [...editor.getCurrentPageShapesSorted()].reverse(); // top-most first

        for (const shape of sortedShapes) {
            const s = shape as any;
            // Skip pins themselves to avoid self-attachment
            if (s.type === 'pin') continue;

            const pageBounds = editor.getShapePageBounds(shape);
            if (!pageBounds) continue;

            // Use page bounds for hit-testing (covers translation; enough for rect shapes)
            if (pageBounds.containsPoint(point)) {
                shapesAtPoint.push(shape);
                if (shapesAtPoint.length >= 2) break;
            }
        }

        // --- Step 2: Create the Pin shape ---
        const pinId = createShapeId();
        editor.createShape<any>({
            id: pinId,
            type: 'pin',
            x: point.x,
            y: point.y,
            props: { text: '', w: 32, h: 32, color: '#ef4444' },
        });

        // --- Step 3: If 2 shapes found, create the attachment binding between them ---
        if (shapesAtPoint.length >= 2) {
            const shapeA = shapesAtPoint[0] as any;
            const shapeB = shapesAtPoint[1] as any;

            // The relative offset: when shapeB moves, shapeA should maintain this offset
            const relativeOffset = {
                x: shapeA.x - shapeB.x,
                y: shapeA.y - shapeB.y,
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
            });
        }

        // --- Step 4: Select the pin so the comment popover opens ---
        editor.setSelectedShapes([pinId]);
        editor.bringToFront([pinId]); // Pins must always render above other shapes
        editor.setCurrentTool('select');
    };
}
