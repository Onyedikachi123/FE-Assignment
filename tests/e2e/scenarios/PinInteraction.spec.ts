/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

test.describe('Pin Tool - Binding & Synchronous Movement', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).__TEST_IS_READY__ === true);
    });

    test('Activating Pin tool shows the cursor indicator', async ({ page }) => {
        const pinBtn = page.locator('[data-testid="tool-btn-pin"]');
        await pinBtn.click();
        await expect(pinBtn).toHaveAttribute('data-active', 'true');
    });

    /**
     * Headless verification of binding logic.
     */
    test('Attaching a pin creates a durable binding that moves synchronously', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const editor = (window as any).editor;

            // 1. Create two overlapping shapes
            const box1Id = 'shape:box1';
            const box2Id = 'shape:box2';

            editor.createShapes([
                {
                    id: box1Id,
                    type: 'geo',
                    x: 100,
                    y: 100,
                    props: { w: 200, h: 200, geo: 'rectangle' },
                } as any,
                {
                    id: box2Id,
                    type: 'geo',
                    x: 120,
                    y: 120,
                    props: { w: 200, h: 200, geo: 'rectangle' },
                } as any,
            ]);

            // 2. Select Pin tool and click the intersection
            editor.setCurrentTool('pin');
            const pinTool = editor.root.children.pin;
            if (!pinTool) throw new Error('Could not find pin tool');

            const point = { x: 150, y: 150 };
            pinTool.onPointerDown({ point, target: 'canvas' } as any);

            // 3. Find the binding
            const allBindings = Object.values(editor.store.allRecords()).filter((r: any) => r.typeName === 'binding');
            const pinBinding = allBindings.find((b: any) => b.type === 'pin-attach');

            let bindingFound = false;
            let moveSuccess = false;
            let finalBox2Pos = null;

            if (pinBinding) {
                bindingFound = true;
                const fromId = (pinBinding as any).fromId;
                const toId = (pinBinding as any).toId;

                const fromShape = editor.getShape(fromId);
                const toShapeBefore = editor.getShape(toId);

                if (fromShape && toShapeBefore) {
                    const startX = (toShapeBefore as any).x;
                    const startY = (toShapeBefore as any).y;

                    editor.updateShape({
                        id: fromId,
                        type: (fromShape as any).type,
                        x: (fromShape as any).x + 50,
                        y: (fromShape as any).y + 50
                    });

                    const toShapeAfter = editor.getShape(toId);
                    if (toShapeAfter && (toShapeAfter as any).x === startX + 50 && (toShapeAfter as any).y === startY + 50) {
                        moveSuccess = true;
                    }
                    finalBox2Pos = { x: (toShapeAfter as any)?.x, y: (toShapeAfter as any)?.y };
                }
            }

            return {
                bindingFound,
                moveSuccess,
                finalBox2Pos,
                numBindings: allBindings.length,
                numShapes: editor.getCurrentPageShapes().length
            };
        });

        console.log('PIN E2E DEBUG:', JSON.stringify(result, null, 2));
        expect(result.bindingFound).toBe(true);
        expect(result.moveSuccess).toBe(true);
    });
});
