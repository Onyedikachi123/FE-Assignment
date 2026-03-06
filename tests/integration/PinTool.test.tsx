import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock pdfjs-dist to prevent DOMMatrix errors in JSDOM
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
    version: '5.5.207'
}));

import { Editor, createTLStore, createShapeId, defaultShapeUtils, TLBinding } from 'tldraw';
import { PinTool } from '../../src/core/engine/tools/PinTool';
import { PinShapeUtil } from '../../src/core/engine/shapes/pin/PinShapeUtil';
import { PdfPageShapeUtil } from '../../src/core/engine/shapes/pdf-page/PdfPageShapeUtil';
import { PinAttachBindingUtil } from '../../src/core/engine/bindings/PinAttachBindingUtil';

// Helper to simulate pointer events
function simulatePointerDown(editor: Editor, x: number, y: number) {
    editor.dispatch({
        type: 'pointer',
        name: 'pointer_down',
        target: 'canvas',
        point: { x, y, z: 0.5 },
        pointerId: 1,
        button: 0,
        isPen: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        accelKey: false
    });
}

function createTestEditor() {
    const store = createTLStore({
        shapeUtils: [...defaultShapeUtils, PinShapeUtil, PdfPageShapeUtil],
        bindingUtils: [PinAttachBindingUtil]
    });

    const container = document.createElement('div');
    document.body.appendChild(container);

    const editor = new Editor({
        store,
        shapeUtils: [...defaultShapeUtils, PinShapeUtil, PdfPageShapeUtil],
        tools: [PinTool],
        bindingUtils: [PinAttachBindingUtil],
        getContainer: () => container
    });

    editor.updateInstanceState({ screenBounds: { x: 0, y: 0, w: 1000, h: 1000 } });
    return editor;
}

describe('PinTool Integration Logic', () => {
    let editor: Editor;

    beforeEach(() => {
        document.body.innerHTML = '';
        editor = createTestEditor();
        // Mock setCurrentTool only for 'select' and 'selection' to avoid state transition errors
        const originalSetCurrentTool = editor.setCurrentTool.bind(editor);
        vi.spyOn(editor, 'setCurrentTool').mockImplementation((toolId: string) => {
            if (toolId === 'select' || toolId === 'selection') return editor;
            return originalSetCurrentTool(toolId);
        });
    });

    it('creates a pin-attach binding when a pin is dropped on overlapping shapes', () => {
        const box1Id = createShapeId('box1');
        const box2Id = createShapeId('box2');

        editor.createShapes([
            { id: box1Id, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100 } },
            { id: box2Id, type: 'geo', x: 20, y: 20, props: { w: 100, h: 100 } }
        ]);

        editor.setCurrentTool('pin');
        simulatePointerDown(editor, 50, 50);

        const bindings = Object.values(editor.store.allRecords()).filter((r) => r.typeName === 'binding') as TLBinding[];
        // Now one binding per shape (2 shapes = 2 bindings)
        expect(bindings.length).toBe(2);
        expect(bindings[0].type).toBe('pin-attach');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pin = editor.getCurrentPageShapes().find(s => (s as any).type === 'pin');
        expect(pin).toBeDefined();

        // All bindings originate from the pin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(bindings.every(b => b.fromId === (pin as any).id)).toBe(true);
    });

    it('maintains the relative offset when the bounded shape is moved', () => {
        const box1Id = createShapeId('box1');
        const box2Id = createShapeId('box2');

        editor.createShapes([
            { id: box1Id, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100 } },
            { id: box2Id, type: 'geo', x: 20, y: 20, props: { w: 100, h: 100 } }
        ]);

        editor.setCurrentTool('pin');
        simulatePointerDown(editor, 50, 50); // Pin at 50,50. Box1 at 0,0 (off -50,-50). Box2 at 20,20 (off -30,-30).

        // Move box 1
        editor.updateShape({ id: box1Id, type: 'geo', x: 100, y: 100 });

        // Expected: Pin moves to 150, 150 (since Box 1 is at offset -50,-50 from Pin)
        // Then Box 2 moves to 120, 120 (since Box 2 is at offset -30,-30 from Pin)
        const box2 = editor.getShape(box2Id);
        expect(box2?.x).toBe(120);
        expect(box2?.y).toBe(120);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pin = editor.getCurrentPageShapes().find(s => (s as any).type === 'pin');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((pin as any)?.x).toBe(150);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((pin as any)?.y).toBe(150);
    });

    it('reverts the binding and shape movements correctly after undoing', () => {
        const box1Id = createShapeId('box1');
        const box2Id = createShapeId('box2');

        editor.createShapes([
            { id: box1Id, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100 } },
            { id: box2Id, type: 'geo', x: 20, y: 20, props: { w: 100, h: 100 } }
        ]);

        editor.setCurrentTool('pin');
        simulatePointerDown(editor, 50, 50);

        const bindingsBeforeUndo = Object.values(editor.store.allRecords()).filter((r) => r.typeName === 'binding');
        expect(bindingsBeforeUndo.length).toBe(2);

        editor.undo();

        const bindingsAfterUndo = Object.values(editor.store.allRecords()).filter((r) => r.typeName === 'binding');
        expect(bindingsAfterUndo.length).toBe(0);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pins = editor.getCurrentPageShapes().filter(s => (s as any).type === 'pin');
        expect(pins.length).toBe(0);
    });
});
