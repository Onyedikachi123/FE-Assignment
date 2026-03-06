import { test, expect } from '@playwright/test';

test('Pin tool locks shapes and they drag together', async ({ page }) => {
    await page.goto('/');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.waitForFunction(() => (window as any).__TEST_IS_READY__ === true);

    // Draw first rectangle (geo shape)
    // Tldraw tools: 'geo' corresponds to rectangle
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.setCurrentTool('geo');
    });
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();

    // Draw second rectangle overlapping
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.setCurrentTool('geo');
    });
    await page.mouse.move(150, 150);
    await page.mouse.down();
    await page.mouse.move(250, 250);
    await page.mouse.up();

    // Select Pin Tool and click on overlapping area
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.setCurrentTool('pin');
    });
    await page.mouse.click(175, 175);

    // Wait for toast
    await expect(page.locator('text=Locked 2 shapes together.')).toBeVisible({ timeout: 5000 });

    // Select tool
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.setCurrentTool('select');
    });

    // Deselect everything
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.selectNone();
    });

    // Drag the first rectangle
    await page.mouse.move(100, 150);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(200, 250, { steps: 5 }); // move delta (100, 100)
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify positions after first drag
    let shapes = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return editor.getCurrentPageShapes().map((s: any) => ({ id: s.id, type: s.type, x: s.x, y: s.y }));
    });
    console.log("SHAPES AFTER DRAG:", shapes);

    const pinShape = shapes.find((s: any) => s.type === 'pin');

    // Select the pin and delete it
    await page.evaluate((pinId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.setSelectedShapes([pinId]);
        editor.deleteShapes([pinId]);
    }, pinShape.id);

    // Deselect
    await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        editor.selectNone();
    });

    // Drag the first rectangle again!
    await page.mouse.move(200, 250);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(300, 350, { steps: 5 }); // move delta (100, 100)
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify positions after second drag
    shapes = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as any).editor;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return editor.getCurrentPageShapes().map((s: any) => ({ id: s.id, type: s.type, x: s.x, y: s.y }));
    });
    console.log("SHAPES AFTER PIN DELETED:", shapes);
});
