import { StateNode, TLPointerEventInfo, createShapeId, TLShapeId } from 'tldraw';
import { useAppStore } from '../../../state/useAppStore';
import { executeCropExport } from './CameraExport';

/**
 * CameraTool (Screen Capture Tool)
 * Staff-level implementation of the "Select -> Release -> Download" workflow.
 * - Handles its own drag-to-select logic.
 * - Shows a thin-border temporary rectangle during drag.
 * - Triggers instant crop-export and download on pointer up.
 */
export class CameraTool extends StateNode {
    static override id = 'camera';

    private isSelecting = false;
    private startPoint = { x: 0, y: 0 };
    private regionId: TLShapeId = createShapeId();

    override onEnter = () => {
        useAppStore.getState().addToast('Drag on canvas to capture area.', 'info');
    };

    override onPointerDown = (info: TLPointerEventInfo) => {
        const { editor } = this;
        const { point } = info;

        this.isSelecting = true;
        this.startPoint = { x: point.x, y: point.y };
        this.regionId = createShapeId();

        editor.markHistoryStoppingPoint('camera-selection-start');

        editor.createShape({
            id: this.regionId,
            type: 'camera',
            x: this.startPoint.x,
            y: this.startPoint.y,
            props: { w: 1, h: 1 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        editor.setSelectedShapes([this.regionId]);
    };

    override onPointerMove = (info: TLPointerEventInfo) => {
        if (!this.isSelecting) return;
        const { editor } = this;
        const { point, shiftKey } = info;

        let rawW = point.x - this.startPoint.x;
        let rawH = point.y - this.startPoint.y;

        if (shiftKey) {
            const side = Math.min(Math.abs(rawW), Math.abs(rawH));
            rawW = Math.sign(rawW) * side;
            rawH = Math.sign(rawH) * side;
        }

        const w = Math.max(1, Math.abs(rawW));
        const h = Math.max(1, Math.abs(rawH));
        const x = rawW < 0 ? this.startPoint.x - w : this.startPoint.x;
        const y = rawH < 0 ? this.startPoint.y - h : this.startPoint.y;

        editor.updateShape({
            id: this.regionId,
            type: 'camera',
            x,
            y,
            props: { w, h },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    };

    override onPointerUp = () => {
        if (!this.isSelecting) return;
        const { editor } = this;
        this.isSelecting = false;

        // Cleanup tiny unintentional clicks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shape = editor.getShape(this.regionId) as any;
        if (shape && (shape.props.w < 5 || shape.props.h < 5)) {
            editor.deleteShape(this.regionId);
        } else {
            editor.setCurrentTool('select');
            useAppStore.getState().addToast('Crop area created. Adjust and click Export.', 'success');
        }
    };

    override onKeyDown = (info: { key: string }) => {
        if (info.key === 'Escape') {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.editor.deleteShape(this.regionId);
            }
            this.editor.setCurrentTool('select');
        }
    };
}
