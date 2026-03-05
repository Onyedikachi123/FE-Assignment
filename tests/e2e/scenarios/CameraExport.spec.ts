/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

test.describe('Camera Tool - Crop & Export', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).__TEST_IS_READY__ === true);
    });

    test('Shift-key locks aspect ratio to 1:1 square during crop draw', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const editor = (window as any).editor;

            // In tldraw, tools are organized under the root state node's children
            const cameraTool = editor.root.children.camera;
            if (!cameraTool) throw new Error('Could not find camera tool');

            editor.setCurrentTool('camera');

            cameraTool.onPointerDown({ point: { x: 100, y: 100 }, target: 'canvas' } as any);
            cameraTool.onPointerMove({ point: { x: 300, y: 250 }, shiftKey: true, target: 'canvas' } as any);

            const shapes = editor.getCurrentPageShapes();
            const crop = shapes.find((s: any) => s.type === 'camera');
            if (!crop) throw new Error('Camera crop shape not found');

            return { w: crop.props.w, h: crop.props.h };
        });

        expect(result.w).toBe(result.h);
        expect(result.w).toBe(150);
    });

    test('Can cancel an active crop via the action bar', async ({ page }) => {
        await page.locator('[data-testid="tool-btn-camera"]').click();
        await page.mouse.move(200, 200);
        await page.mouse.down();
        await page.mouse.move(400, 400);
        await page.mouse.up();

        const actionBar = page.locator('[data-testid="camera-action-bar"]');
        await expect(actionBar).toBeVisible();

        await actionBar.locator('button[title="Cancel"]').click();
        await expect(actionBar).toBeHidden();
    });
});
