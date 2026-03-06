# Canvas App — PDF Annotation Studio

A production-grade canvas application for annotating PDF documents, powered by
**tldraw v4**, **pdf.js v5**, **Next.js 16**, and **Zustand v5**.

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Next.js 16 (App Router) |
| Canvas Engine    | tldraw v4               |
| PDF Rendering    | pdfjs-dist v5           |
| State Management | Zustand v5              |
| UI Library       | React 19                |
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

## Key Features

### 📄 Task 2 — High-Performance PDF Rendering

- **Worker-Based Rendering**: PDF parsing and rendering happen in a background
  Web Worker, keeping the UI at a butter-smooth 60fps.
- **Hardware Acceleration**: Uses `OffscreenCanvas` and `ImageBitmap` for
  zero-copy data transfer between the worker and the main thread.
- **Intelligent LRU Cache**: Automatically manages memory by caching only the
  most recently used 20 page textures.
- **Viewport Virtualization**: Only visible pages are rendered; off-screen pages
  use shimmering skeleton placeholders.
- **Retina Support**: Renders at the system's native `devicePixelRatio` for
  perfectly crisp text.

### 📍 Task 3 — Advanced Pin & Binding Tool (`P`)

- **Bidirectional Locking**: Placing a pin on two overlapping shapes creates a
  native `pin-attach` binding. Moving one move the other—mirroring real-life
  physics.
- **Numeric Feedback**: Pins display a live counter badge showing exactly how
  many shapes are currently locked together.
- **Undo/Redo Ready**: Built using tldraw's `BindingUtil` API, ensuring all
  attachments are perfectly tracked in the undo history.

### 📷 Task 4 — Smart Camera / Capture Tool (`C`)

- **Instant Export**: Draw a region to instantly download a high-resolution PNG.
  The overlay cleans itself up automatically.
- **Retina Exports**: Captured images are flattened and exported at 2× scale for
  professional fidelity.
- **Zero UI Pollution**: The crop overlay and editor UI are filtered out during
  export, capturing only your creative content.

### 🎯 Unified Creation Workflow (`V`)

- **Contextual Action Bar**: Selecting shapes with the **Select Tool (V)**
  reveals a floating menu above your selection.
- **One-Click Tasks**: Instantly "Pin Selection" or "Capture Area" without
  switching tools.
- **Cold Start UI**: Tools start in a clean "unclicked" state, ensuring a
  focused and professional first impression.
- **Rectangle Tool (R)**: A dedicated geometry tool for creating layout blocks
  that can later be pinned or captured.

---

## Keyboard Shortcuts

| Key   | Action                                     |
| ----- | ------------------------------------------ |
| `V`   | **Select** (Contextual Pin/Camera Actions) |
| `R`   | **Rectangle** tool                         |
| `P`   | **Pin** tool (Point-to-click)              |
| `C`   | **Camera** tool (Drag-to-download)         |
| `Esc` | Return to Select / Cancel current action   |

---

## Project Structure

```
src/
├── app/               # Next.js App Router
├── core/
│   ├── engine/        # tldraw architecture
│   │   ├── TldrawCanvas.tsx      # Main engine host
│   │   ├── SelectionActionBar.tsx # Contextual UI
│   │   ├── shapes/               # Custom ShapeUtils
│   │   ├── tools/                # Custom StateNodes
│   │   └── bindings/             # BindingUtil logic
│   └── pdf/           # Worker-based PDF pipeline
├── state/             # Zustand (Toast, Upload, Doc state)
└── ui/                # React Overlays (Toolbar, Toast, Tabs)

tests/
├── unit/              # Vitest (Cache logic, geometry)
└── e2e/               # Playwright (User flows, exports)
```

---

## Architecture Decisions

- **Single Source of Truth**: Spatial data lives exclusively in the tldraw
  store. Zustand handles transient UI states like upload progress and toasts.
- **Worker Isolation**: The PDF rendering pipeline is strictly isolated from the
  main thread to prevent UI freezing during document navigation.
- **Binding System**: We use `BindingUtil` instead of `groups` to allow for
  complex, overlapping, and bidirectional relationships between shapes.
- **Dynamic Imports**: The entire canvas stack is loaded dynamically with
  `ssr: false` to ensure a stable Next.js hydration cycle.
