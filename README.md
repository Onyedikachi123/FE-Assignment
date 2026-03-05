# Canvas App — PDF Annotation Studio

A production-grade canvas application for annotating PDF documents, powered by
**tldraw**, **pdf.js**, **Next.js 16**, and **Zustand**.

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Next.js 16 (App Router) |
| Canvas Engine    | tldraw v4               |
| PDF Rendering    | pdfjs-dist v5           |
| State Management | Zustand v5              |
| Styling          | TailwindCSS v4          |
| Type Safety      | TypeScript (strict)     |
| Unit Testing     | Vitest                  |
| E2E Testing      | Playwright              |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000
```

---

## Features

### Task 2 — PDF Rendering

- Drag & drop any PDF onto the canvas
- Each page renders as a custom tldraw shape
- **OffscreenCanvas** rendering keeps the UI thread unblocked at 60fps
- **LRU cache** (max 20 bitmaps) prevents OOM crashes on large documents
- **Debounced zoom re-render** — during zoom, stale bitmaps are scaled natively;
  after 150ms of stillness, crisp high-res textures are fetched
- **Viewport virtualisation** — only visible pages request renders; off-screen
  pages remain as skeletons
- Retina / High-DPI support via `devicePixelRatio`

### Task 3 — Pin Tool (`P`)

- Click any point on the canvas to place a pin annotation
- If the pin lands on top of **2 overlapping shapes**, a `pin-attach` binding is
  created between those 2 shapes — moving either shape moves the other
  (bidirectional, undo-safe)
- Attachment uses tldraw's native **BindingUtil** system — fully compatible with
  CMD+Z
- Selected pins show a comment popover (autoFocus, Escape to close)

### Task 4 — Camera Tool (`C`)

- Click and drag to draw a crop region on the canvas
- The crop box stays visible; a **floating action bar** appears with:
  - **Save PNG** — exports the region as a retina-quality 2× PNG
  - **Copy** — writes the PNG blob to the system clipboard
  - **Cancel** — discards the crop and returns to select
- Hold **Shift** while dragging to lock 1:1 aspect ratio
- High-res PDF textures are pre-fetched before export

---

## Keyboard Shortcuts

| Key   | Action                               |
| ----- | ------------------------------------ |
| `V`   | Select tool                          |
| `P`   | Pin tool                             |
| `C`   | Camera (Crop) tool                   |
| `Esc` | Return to Select / close pin popover |

---

## Project Structure

```
src/
├── app/               # Next.js App Router (page, layout)
├── core/
│   ├── engine/        # tldraw integration
│   │   ├── TldrawCanvas.tsx      # Main canvas host
│   │   ├── bindings/             # PinAttachBindingUtil
│   │   ├── shapes/               # PdfPageShapeUtil, PinShapeUtil
│   │   └── tools/                # PinTool, CameraTool
│   └── pdf/           # PDF pipeline (PdfWorkerManager, PdfCache)
├── state/             # Zustand stores (useAppStore, useDocStore)
└── ui/                # React overlays (Toolbar, CameraActionBar, ErrorBoundary)

tests/
├── unit/              # Vitest unit tests (LRU cache, geometry math)
├── integration/       # tldraw store integration tests
└── e2e/               # Playwright end-to-end tests
```

---

## Running Tests

```bash
# Unit tests (instant, no browser)
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (requires npm run dev running)
npm run test:e2e

# E2E with interactive UI
npm run test:e2e:ui
```

---

## Architecture Decisions

- **tldraw = sole authority on spatial data** — Zustand stores only UI state
  (file name, upload status, crop bounds). No `x/y/zoom` ever enters Zustand.
- **BindingUtil for shape attachment** — native tldraw bindings execute within
  the same store transaction as the shape move, guaranteeing perfect undo/redo
  integrity.
- **OffscreenCanvas + ImageBitmap** — zero-copy transfer from the render context
  to the main thread; no DOM canvas elements are created during PDF rendering.
- **next/dynamic with `ssr: false`** — the entire tldraw engine is excluded from
  the SSR pass to prevent `window is not defined` crashes.
