import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * transpilePackages: tldraw ships as ESM and requires transpilation
   * within the Next.js compilation pipeline to prevent module resolution
   * errors in production builds.
   */
  transpilePackages: ['tldraw', '@tldraw/editor', '@tldraw/state', '@tldraw/store'],

  /**
   * turbopack: {} — empty config satisfies Next.js 16's requirement that
   * any project with a `webpack` config must also declare a `turbopack` config.
   * Turbopack handles the canvas alias natively, so no extra config is needed.
   */
  turbopack: {},

  /**
   * webpack: used for production builds (`next build`).
   * Suppress the "Critical dependency: require()" warning from pdf.js internals.
   */
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false, // pdf.js canvas polyfill — not needed, we use OffscreenCanvas
    };
    return config;
  },
};

export default nextConfig;

