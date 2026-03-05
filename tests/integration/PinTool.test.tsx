import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock pdfjs-dist to prevent DOMMatrix errors in JSDOM
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
    version: '5.5.207'
}));

import { Editor, createTLStore, createShapeId, defaultShapeUtils, TLBinding, TLShape } from 'tldraw';
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
        // Mock setCurrentTool only for 'select' to avoid state transition errors
        const originalSetCurrentTool = editor.setCurrentTool.bind(editor);
        vi.spyOn(editor, 'setCurrentTool').mockImplementation((toolId: string) => {
            if (toolId === 'select') return editor;
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
        expect(bindings.length).toBe(1);
        expect(bindings[0].type).toBe('pin-attach');

        const binding = bindings[0];
        expect(binding.fromId).toBe(box2Id);
        expect(binding.toId).toBe(box1Id);
    });

    it('maintains the relative offset when the bounded shape is moved', () => {
        const box1Id = createShapeId('box1');
        const box2Id = createShapeId('box2');

        editor.createShapes([
            { id: box1Id, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100 } },
            { id: box2Id, type: 'geo', x: 20, y: 20, props: { w: 100, h: 100 } }
        ]);

        editor.setCurrentTool('pin');
        simulatePointerDown(editor, 50, 50);

        editor.updateShape({ id: box1Id, type: 'geo', x: 100, y: 100 });

        const box2 = editor.getShape(box2Id);
        expect(box2?.x).toBe(120);
        expect(box2?.y).toBe(120);
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
        expect(bindingsBeforeUndo.length).toBe(1);

        editor.undo();

        const bindingsAfterUndo = Object.values(editor.store.allRecords()).filter((r) => r.typeName === 'binding');
        expect(bindingsAfterUndo.length).toBe(0);

        const pins = editor.getCurrentPageShapes().filter(s => (s as TLShape).type === 'pin');
        expect(pins.length).toBe(0);
    });
});
