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

// Mock the export logic
vi.mock('../../../src/core/engine/tools/CameraExport', () => ({
    executeCropExport: vi.fn().mockResolvedValue(undefined),
}));

// Now we can safely import CameraTool
import { CameraTool } from '../../../src/core/engine/tools/CameraTool';

/**
 * CameraTool (Instant Capture) Tests
 * - Verifies the "Screen Capture" behavior.
 */
describe('CameraTool (Instant Capture)', () => {
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
            setSelectedShapes: vi.fn(),
            markHistoryStoppingPoint: vi.fn(),
        } as unknown as Editor;

        // Initialize tool
        cameraTool = new CameraTool(editor);
    });

    it('creates a "capture-region" shape on pointer down', () => {
        const info = { point: startPoint } as TLPointerEventInfo;
        cameraTool.onPointerDown(info);

        expect(editor.createShape).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'capture-region',
                x: 100,
                y: 100,
            })
        );
    });

    it('triggers export and cleanup on pointer up', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let createdId: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor.createShape as any).mockImplementation((args: any) => {
            createdId = args.id;
        });

        const info = { point: startPoint } as TLPointerEventInfo;
        cameraTool.onPointerDown(info);

        const mockRegion = {
            id: createdId,
            type: 'capture-region',
            x: 100, y: 100,
            props: { w: 200, h: 200 }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(editor, 'getShape').mockReturnValue(mockRegion as any);

        // Execute capture
        await cameraTool.onPointerUp();

        const { executeCropExport } = await import('../../../src/core/engine/tools/CameraExport');
        expect(executeCropExport).toHaveBeenCalledWith(editor, { x: 100, y: 100, w: 200, h: 200 }, 'download');

        // Verify cleanup precisely with the dynamic ID
        expect(editor.deleteShape).toHaveBeenCalledWith(createdId);
    });
});
