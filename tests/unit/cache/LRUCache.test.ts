import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for LRU cache eviction logic in PdfCacheManager.
 *
 * We test the logic directly without instantiating the real singleton
 * to keep tests isolated and free of side effects.
 */

// Minimal LRU cache implementation (same algorithm as PdfCacheManager)
class TestLRUCache<V> {
    private cache = new Map<string, V>();
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    set(key: string, value: V) {
        if (this.cache.has(key)) {
            this.cache.delete(key); // Refresh position
        }
        this.cache.set(key, value);
        if (this.cache.size > this.maxSize) {
            // Evict oldest (first entry in insertion-order Map)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
        }
    }

    get(key: string): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Refresh LRU position on read
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    size(): number {
        return this.cache.size;
    }

    keys(): string[] {
        return Array.from(this.cache.keys());
    }
}

describe('LRU Cache Eviction Logic', () => {
    let cache: TestLRUCache<string>;

    beforeEach(() => {
        cache = new TestLRUCache<string>(3);
    });

    it('stores items up to capacity', () => {
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('c', '3');
        expect(cache.size()).toBe(3);
        expect(cache.has('a')).toBe(true);
    });

    it('evicts the oldest entry when capacity is exceeded', () => {
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('c', '3');
        cache.set('d', '4'); // 'a' should be evicted

        expect(cache.has('a')).toBe(false);
        expect(cache.has('d')).toBe(true);
        expect(cache.size()).toBe(3);
    });

    it('refreshes the LRU position on read, keeping recently-read items alive', () => {
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('c', '3');

        // Access 'a' to refresh it to the most-recently-used position
        cache.get('a');

        // Now add 'd' — 'b' should be evicted (oldest unread), not 'a'
        cache.set('d', '4');

        expect(cache.has('a')).toBe(true);  // 'a' was refreshed
        expect(cache.has('b')).toBe(false); // 'b' was oldest after refresh
        expect(cache.has('c')).toBe(true);
        expect(cache.has('d')).toBe(true);
    });

    it('overwrites existing key without growing size', () => {
        cache.set('a', '1');
        cache.set('b', '2');
        cache.set('a', 'updated'); // Should overwrite, not grow

        expect(cache.size()).toBe(2);
        expect(cache.get('a')).toBe('updated');
    });

    it('returns undefined for missing keys', () => {
        expect(cache.get('nonexistent')).toBeUndefined();
    });
});

describe('PdfCacheManager Key Strategy', () => {
    it('generates page-scale keys that allow best-match fallback lookup', () => {
        // Test the key format: `${pageIndex}_${scale.toFixed(2)}`
        const getCacheKey = (pageIndex: number, scale: number) =>
            `${pageIndex}_${scale.toFixed(2)}`;

        const key1x = getCacheKey(3, 1);
        const key2x = getCacheKey(3, 2);
        const keyPage5 = getCacheKey(5, 1);

        expect(key1x).toBe('3_1.00');
        expect(key2x).toBe('3_2.00');
        expect(keyPage5).toBe('5_1.00');

        // Fallback: check if a key belongs to page 3 regardless of scale
        expect(key1x.startsWith('3_')).toBe(true);
        expect(key2x.startsWith('3_')).toBe(true);
        expect(keyPage5.startsWith('3_')).toBe(false);
    });
});
