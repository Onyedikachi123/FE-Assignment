import { StateNode, TLPointerEventInfo, Box, createShapeId, TLShapeId, TLShape } from 'tldraw';
import { useAppStore } from '../../../state/useAppStore';

/**
 * CameraTool
 * A dedicated tool for cropping regions of the canvas.
 * - Production-quality math for 4-directional dragging
 * - Shift-key locking for 1:1 square aspect ratio
 * - Handles the 'camera' custom shape for high-contrast overlays
 */
export class CameraTool extends StateNode {
    static override id = 'camera';

    private isDrawing = false;
    private startPoint = { x: 0, y: 0 };
    private cropShapeId: TLShapeId = createShapeId();

    override onPointerDown = (info: TLPointerEventInfo) => {
        this.isDrawing = true;
        this.startPoint = { x: info.point.x, y: info.point.y };
        this.cropShapeId = createShapeId();

        this.editor.createShape({
            id: this.cropShapeId,
            type: 'camera',
            x: this.startPoint.x,
            y: this.startPoint.y,
            props: { w: 1, h: 1 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    };

    override onPointerMove = (info: TLPointerEventInfo) => {
        if (!this.isDrawing) return;
        const { point, shiftKey } = info;

        let rawW = point.x - this.startPoint.x;
        let rawH = point.y - this.startPoint.y;

        // Production-quality aspect-ratio math (Shift-key)
        if (shiftKey) {
            const side = Math.min(Math.abs(rawW), Math.abs(rawH));
            rawW = Math.sign(rawW) * side;
            rawH = Math.sign(rawH) * side;
        }

        const w = Math.abs(rawW);
        const h = Math.abs(rawH);

        // Correct for 4-directional dragging (top-left vs bottom-right)
        const x = rawW < 0 ? this.startPoint.x - w : this.startPoint.x;
        const y = rawH < 0 ? this.startPoint.y - h : this.startPoint.y;

        this.editor.updateShape({
            id: this.cropShapeId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: 'camera' as any,
            x,
            y,
            props: { w, h },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    };

    override onPointerUp = () => {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Retrieve current crop bounds safely
        const cropShape = this.editor.getShape(this.cropShapeId) as TLShape & { props: { w: number, h: number } };
        if (!cropShape || (cropShape as unknown as { type: string }).type !== 'camera') return;

        const bounds = new Box(
            cropShape.x,
            cropShape.y,
            cropShape.props.w,
            cropShape.props.h
        );

        // Clean up tiny accidental clicks
        if (bounds.w < 10 || bounds.h < 10) {
            this.editor.deleteShape(this.cropShapeId);
            return;
        }

        // Persist crop metadata to UI layer; keeps action bar positioned correctly
        useAppStore.getState().setCropBox(
            { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            this.cropShapeId
        );
    };

    override onKeyDown = (info: { key: string }) => {
        if (info.key === 'Escape') {
            this.cancelCrop();
        }
    };

    private cancelCrop() {
        if (this.isDrawing) {
            this.isDrawing = false;
        }
        if (this.cropShapeId) {
            this.editor.deleteShape(this.cropShapeId);
        }
        useAppStore.getState().setCropBox(null, null);
        this.editor.setCurrentTool('select');
    }
}
