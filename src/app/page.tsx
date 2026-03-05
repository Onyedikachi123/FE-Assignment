'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const TldrawCanvasWithNoSSR = dynamic(
  () => import('../core/engine/TldrawCanvas'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="w-screen h-screen flex flex-col bg-slate-950 overflow-hidden">
      <ErrorBoundary>
        <div className="flex-1 relative w-full h-full">
          <TldrawCanvasWithNoSSR>
            {/* Toolbar is rendered inside <Tldraw> so useEditor() works */}
            {/* It is passed as children and rendered via {children} in TldrawCanvas */}
          </TldrawCanvasWithNoSSR>
        </div>
      </ErrorBoundary>
    </main>
  );
}
