/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';

test.describe('Instant Camera Capture Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).__TEST_IS_READY__ === true);
    });

    test('Camera Tool performs instant capture in one drag cycle', async ({ page }) => {
        // 1. Activate Camera Tool (C)
        await page.locator('[data-testid="tool-btn-camera"]').click();

        // 2. Drag to capture area
        await page.mouse.move(200, 200);
        await page.mouse.down();
        await page.mouse.move(400, 400); // 200x200 box

        // During drag, the capture-region should exist
        const existsDuringDrag = await page.evaluate(() => {
            const editor = (window as any).editor;
            return editor.getCurrentPageShapes().some((s: any) => s.type === 'capture-region');
        });
        expect(existsDuringDrag).toBe(true);

        // 3. Release mouse -> Should trigger capture & cleanup
        await page.mouse.up();

        // After cleanup, capture-region should be gone
        const existsAfterUp = await page.evaluate(() => {
            const editor = (window as any).editor;
            return editor.getCurrentPageShapes().some((s: any) => s.type === 'capture-region');
        });
        expect(existsAfterUp).toBe(false);

        // Toast should indicate export success
        await expect(page.locator('[data-testid="toast-message"]').filter({ hasText: 'Exported' })).toBeVisible({ timeout: 15000 });
    });

    test('Shift-key locks capture to 1:1 square', async ({ page }) => {
        await page.locator('[data-testid="tool-btn-camera"]').click();

        await page.mouse.move(100, 100);
        await page.keyboard.down('Shift');
        await page.mouse.down();
        await page.mouse.move(300, 250); // Intention: 200x150

        const dragBounds = await page.evaluate(() => {
            const editor = (window as any).editor;
            const shape = editor.getCurrentPageShapes().find((s: any) => s.type === 'capture-region');
            return { w: shape.props.w, h: shape.props.h };
        });

        expect(dragBounds.w).toBe(150);
        expect(dragBounds.h).toBe(150);

        await page.mouse.up();
        await page.keyboard.up('Shift');
    });
});
