import { describe, it, expect } from 'vitest';

/**
 * Unit tests for coordinate math used by PinTool and CameraTool.
 *
 * These are pure functions — no DOM, no tldraw, no browser APIs.
 * They test the critical geometric logic that underpins:
 *  - normalised offset calculation (Pin→Shape binding anchor)
 *  - Box intersection math (Camera Tool crop filtering)
 *  - Relative offset calculation (PinAttachBindingUtil)
 */

// --- Helpers (mirroring real production logic) ---

interface Point { x: number; y: number; }
interface BBox { x: number; y: number; w: number; h: number; }

function normalisedOffset(point: Point, shapeOrigin: Point, bounds: BBox): Point {
    return {
        x: (point.x - shapeOrigin.x) / bounds.w,
        y: (point.y - shapeOrigin.y) / bounds.h,
    };
}

function relativeOffset(shapeA: Point, shapeB: Point): Point {
    return { x: shapeA.x - shapeB.x, y: shapeA.y - shapeB.y };
}

function boxCollides(a: BBox, b: BBox): boolean {
    return !(
        a.x + a.w < b.x ||
        b.x + b.w < a.x ||
        a.y + a.h < b.y ||
        b.y + b.h < a.y
    );
}

function applyRelativeOffset(anchor: Point, offset: Point): Point {
    return { x: anchor.x + offset.x, y: anchor.y + offset.y };
}

// --- Tests ---

describe('Normalised Offset Calculation (Pin Tool)', () => {
    it('returns (0.5, 0.5) for dead-center of a 100x100 shape at origin', () => {
        const origin = { x: 0, y: 0 };
        const bounds = { x: 0, y: 0, w: 100, h: 100 };
        const point = { x: 50, y: 50 };

        const offset = normalisedOffset(point, origin, bounds);
        expect(offset.x).toBeCloseTo(0.5);
        expect(offset.y).toBeCloseTo(0.5);
    });

    it('returns (0, 0) for top-left corner', () => {
        const origin = { x: 200, y: 300 };
        const bounds = { x: 200, y: 300, w: 400, h: 600 };
        const point = { x: 200, y: 300 };

        const offset = normalisedOffset(point, origin, bounds);
        expect(offset.x).toBeCloseTo(0);
        expect(offset.y).toBeCloseTo(0);
    });

    it('returns (1, 1) for bottom-right corner', () => {
        const origin = { x: 100, y: 100 };
        const bounds = { x: 100, y: 100, w: 200, h: 400 };
        const point = { x: 300, y: 500 };

        const offset = normalisedOffset(point, origin, bounds);
        expect(offset.x).toBeCloseTo(1);
        expect(offset.y).toBeCloseTo(1);
    });
});

describe('Relative Offset (PinAttachBindingUtil)', () => {
    it('calculates correct offset between two shapes', () => {
        const shapeA = { x: 150, y: 200 };
        const shapeB = { x: 100, y: 100 };
        const offset = relativeOffset(shapeA, shapeB);

        expect(offset.x).toBe(50);
        expect(offset.y).toBe(100);
    });

    it('restores shapeA position from shapeB + offset', () => {
        const shapeA = { x: 150, y: 200 };
        const shapeB = { x: 100, y: 100 };
        const offset = relativeOffset(shapeA, shapeB);

        // Simulate shapeB moving to (200, 200) — shapeA should also move
        const newShapeB = { x: 200, y: 200 };
        const expectedShapeA = applyRelativeOffset(newShapeB, offset);

        expect(expectedShapeA.x).toBe(250); // 200 + 50
        expect(expectedShapeA.y).toBe(300); // 200 + 100
    });

    it('handles negative offsets (shapeA is above-left of shapeB)', () => {
        const shapeA = { x: 50, y: 50 };
        const shapeB = { x: 100, y: 100 };
        const offset = relativeOffset(shapeA, shapeB); // { x: -50, y: -50 }

        const newShapeB = { x: 200, y: 200 };
        const expectedShapeA = applyRelativeOffset(newShapeB, offset);

        expect(expectedShapeA.x).toBe(150);
        expect(expectedShapeA.y).toBe(150);
    });
});

describe('Box Collision Detection (Camera Tool)', () => {
    it('detects overlapping boxes', () => {
        const crop = { x: 0, y: 0, w: 200, h: 200 };
        const shape = { x: 100, y: 100, w: 200, h: 200 };
        expect(boxCollides(crop, shape)).toBe(true);
    });

    it('returns false for non-overlapping boxes', () => {
        const crop = { x: 0, y: 0, w: 100, h: 100 };
        const shape = { x: 200, y: 200, w: 100, h: 100 };
        expect(boxCollides(crop, shape)).toBe(false);
    });

    it('detects touching boxes (edge case — shared boundary)', () => {
        const crop = { x: 0, y: 0, w: 100, h: 100 };
        const shape = { x: 100, y: 0, w: 100, h: 100 }; // Shares x=100 edge
        expect(boxCollides(crop, shape)).toBe(true);
    });

    it('detects fully-contained box', () => {
        const crop = { x: 0, y: 0, w: 500, h: 500 };
        const small = { x: 100, y: 100, w: 50, h: 50 };
        expect(boxCollides(crop, small)).toBe(true);
    });
});
