import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editor, TLPointerEventInfo } from 'tldraw';

// Mock the app store to avoid global side-effects during unit testing
vi.mock('../../../src/state/useAppStore', () => ({
    useAppStore: {
        getState: () => ({
            setCropBox: vi.fn(),
            addToast: vi.fn(),
        })
    }
}));

// Now we can safely import CameraTool without heavy PDF dependencies
import { CameraTool } from '../../../src/core/engine/tools/CameraTool';

/**
 * CameraTool Tests
 */
describe('CameraTool', () => {
    let editor: Editor;
    let cameraTool: CameraTool;
    const startPoint = { x: 100, y: 100 };

    beforeEach(() => {
        // Mock the tldraw Editor
        editor = {
            createShape: vi.fn(),
            updateShape: vi.fn(),
            deleteShape: vi.fn(),
            getShape: vi.fn(),
            setCurrentTool: vi.fn(),
            getCurrentPageShapes: vi.fn().mockReturnValue([]),
        } as unknown as Editor;

        // Initialize tool manually for testing
        cameraTool = new CameraTool(editor);
    });

    it('creates a "camera" shape on pointer down', () => {
        const info = { point: startPoint } as TLPointerEventInfo;
        cameraTool.onPointerDown(info);

        expect(editor.createShape).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'camera',
                x: 100,
                y: 100,
            })
        );
    });

    it('updates "camera" shape bounds on pointer move', () => {
        cameraTool.onPointerDown({ point: startPoint } as TLPointerEventInfo);

        const movePoint = { x: 250, y: 300 }; // w=150, h=200
        cameraTool.onPointerMove({ point: movePoint, shiftKey: false } as TLPointerEventInfo);

        expect(editor.updateShape).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'camera',
                x: 100,
                y: 100,
                props: { w: 150, h: 200 }
            })
        );
    });

    it('constrains to a 1:1 square when Shift is held', () => {
        cameraTool.onPointerDown({ point: startPoint } as TLPointerEventInfo);

        const movePoint = { x: 300, y: 250 }; // Attempt 200x150
        cameraTool.onPointerMove({ point: movePoint, shiftKey: true } as TLPointerEventInfo);

        // Should lock to min side (150) -> 150x150
        expect(editor.updateShape).toHaveBeenCalledWith(
            expect.objectContaining({
                props: { w: 150, h: 150 }
            })
        );
    });

    it('handles negative movement (dragging up/left) correctly', () => {
        cameraTool.onPointerDown({ point: startPoint } as TLPointerEventInfo);

        const movePoint = { x: 50, y: 50 }; // Dragging -50 in both axes
        cameraTool.onPointerMove({ point: movePoint, shiftKey: false } as TLPointerEventInfo);

        // Bounds should be at x=50, y=50, w=50, h=50
        expect(editor.updateShape).toHaveBeenCalledWith(
            expect.objectContaining({
                x: 50,
                y: 50,
                props: { w: 50, h: 50 }
            })
        );
    });
});
