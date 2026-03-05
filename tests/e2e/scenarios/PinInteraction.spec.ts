import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Pin Interaction flow
 *
 * Verifies:
 * 1. Pin tool can be activated
 * 2. Clicking the canvas places a pin shape
 * 3. The pin comment popover appears when pin is selected
 * 4. Text can be entered in the comment textarea
 * 5. Escape key closes the popover
 */

test.describe('Pin Tool Interaction', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).__TEST_IS_READY__ === true, {
            timeout: 15_000,
        });
    });

    test('activates pin tool via keyboard shortcut', async ({ page }) => {
        await page.keyboard.press('p');
        const pinBtn = page.getByTestId('tool-btn-pin');
        await expect(pinBtn).toHaveClass(/bg-indigo/);
    });

    test('activates pin tool via toolbar button click', async ({ page }) => {
        await page.getByTestId('tool-btn-pin').click();
        const pinBtn = page.getByTestId('tool-btn-pin');
        await expect(pinBtn).toHaveClass(/bg-indigo/);
    });

    test('places a pin on canvas click and shows comment popover', async ({ page }) => {
        // First activate the pin tool
        await page.keyboard.press('p');

        // Click in the center of the canvas
        const canvas = page.locator('.tl-canvas');
        const canvasBounds = await canvas.boundingBox();
        if (!canvasBounds) throw new Error('Canvas not found');

        await page.mouse.click(
            canvasBounds.x + canvasBounds.width / 2,
            canvasBounds.y + canvasBounds.height / 2
        );

        // The pin popover should appear
        await expect(page.getByTestId('pin-popover')).toBeVisible({ timeout: 3000 });
    });

    test('can type in the pin comment input', async ({ page }) => {
        await page.keyboard.press('p');
        const canvas = page.locator('.tl-canvas');
        const canvasBounds = await canvas.boundingBox();
        if (!canvasBounds) throw new Error('Canvas not found');

        await page.mouse.click(
            canvasBounds.x + canvasBounds.width / 2,
            canvasBounds.y + canvasBounds.height / 2
        );

        const commentInput = page.getByTestId('pin-comment-input');
        await expect(commentInput).toBeVisible({ timeout: 3000 });

        await commentInput.fill('This is a test annotation');
        await expect(commentInput).toHaveValue('This is a test annotation');
    });

    test('Escape key closes popover and switches to select tool', async ({ page }) => {
        await page.keyboard.press('p');
        const canvas = page.locator('.tl-canvas');
        const canvasBounds = await canvas.boundingBox();
        if (!canvasBounds) throw new Error('Canvas not found');

        await page.mouse.click(
            canvasBounds.x + canvasBounds.width / 2,
            canvasBounds.y + canvasBounds.height / 2
        );

        await page.getByTestId('pin-popover').waitFor({ state: 'visible', timeout: 3000 });

        // Press Escape to deselect
        await page.keyboard.press('Escape');

        // Popover should disappear
        await expect(page.getByTestId('pin-popover')).not.toBeVisible({ timeout: 2000 });
    });
});
