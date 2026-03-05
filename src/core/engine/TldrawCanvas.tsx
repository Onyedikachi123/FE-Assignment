'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import {
    Tldraw,
    Editor,
    createShapeId,
    TLStateNodeConstructor,
    TLShapeUtilConstructor,
    TLBindingUtilConstructor,
    useEditor,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { PdfPageShapeUtil } from './shapes/pdf-page/PdfPageShapeUtil';
import { PinShapeUtil } from './shapes/pin/PinShapeUtil';
import { PinTool } from './tools/PinTool';
import { CameraTool } from './tools/CameraTool';
import { PinAttachBindingUtil } from './bindings/PinAttachBindingUtil';
import { pdfWorkerManager } from '../pdf/PdfWorkerManager';
import { pdfCacheManager } from '../pdf/PdfCache';
import { useDocStore } from '../../state/useDocStore';
import { useAppStore } from '../../state/useAppStore';
import { EditorContext } from './EditorContext';
import { Toolbar } from '../../ui/Toolbar';
import { CameraActionBar } from '../../ui/CameraActionBar';

const customShapeUtils: readonly TLShapeUtilConstructor<any>[] = [PdfPageShapeUtil, PinShapeUtil];
const customTools: readonly TLStateNodeConstructor[] = [PinTool, CameraTool];
const customBindingUtils: readonly TLBindingUtilConstructor<any>[] = [PinAttachBindingUtil];

const A4_W = 595;
const A4_H = 842;
const PAGE_GAP = 24;

// ---------------------------------------------------------------------------
// ZoomSyncManager — stays INSIDE <Tldraw> so useEditor() works.
// ---------------------------------------------------------------------------
function ZoomSyncManager() {
    const editor = useEditor();
    const lastZoomRef = useRef(editor.getCamera().z);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubscribe = editor.store.listen(() => {
            const currentZ = editor.getCamera().z;
            if (currentZ === lastZoomRef.current) return;
            lastZoomRef.current = currentZ;

            if (timerRef.current) clearTimeout(timerRef.current);

            timerRef.current = setTimeout(() => {
                const scale = editor.getCamera().z;
                const dpr = editor.getInstanceState().devicePixelRatio;
                const viewportBounds = editor.getViewportPageBounds();

                editor
                    .getCurrentPageShapes()
                    .filter((s) => (s as any).type === 'pdf-page')
                    .filter((s) => {
                        const bounds = editor.getShapePageBounds(s);
                        return bounds && viewportBounds.collides(bounds);
                    })
                    .forEach((s) => {
                        const props = (s as any).props;
                        pdfCacheManager
                            .invalidateAndRerender(props.pageIndex, scale, dpr, editor, s.id)
                            .catch(console.error);
                    });
            }, 150);
        });

        return () => {
            unsubscribe();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [editor]);

    return null;
}

// ---------------------------------------------------------------------------
// DropZone — registers capture-phase window listeners INSIDE <Tldraw> so
// it can read useEditor(). The capture phase runs before tldraw's own
// bubble-phase event handlers, letting us intercept PDF file drops first.
// ---------------------------------------------------------------------------
function DropZone({ onPdfFile }: { onPdfFile: (file: File) => void }) {
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) {
                e.preventDefault(); // signal "droppable"
                e.stopPropagation();
            }
        };

        const handleDrop = (e: DragEvent) => {
            const files = Array.from(e.dataTransfer?.files ?? []);
            const pdf = files.find((f) => f.type === 'application/pdf');
            if (!pdf) return;

            e.preventDefault();
            e.stopImmediatePropagation(); // prevent tldraw from also handling this
            onPdfFile(pdf);
        };

        // CAPTURE phase — fires before tldraw's bubble-phase listeners
        document.addEventListener('dragover', handleDragOver, true);
        document.addEventListener('drop', handleDrop, true);

        return () => {
            document.removeEventListener('dragover', handleDragOver, true);
            document.removeEventListener('drop', handleDrop, true);
        };
    }, [onPdfFile]);

    return null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function TldrawCanvas({ children }: { children?: React.ReactNode }) {
    const setUploading = useAppStore((s) => s.setUploading);
    const setDocument = useDocStore((s) => s.setDocument);
    const editorRef = useRef<Editor | null>(null);

    // We expose the editor via React state so the Context propagation triggers
    // a re-render of Toolbar/CameraActionBar when the editor first becomes available.
    const [editorReady, setEditorReady] = useState(false);

    // ---------------------------------------------------------------------------
    // PDF processing logic (shared between DropZone and any future upload button)
    // ---------------------------------------------------------------------------
    const processPdfFile = useCallback(
        async (file: File) => {
            const editor = editorRef.current;
            if (!editor) return;

            setUploading(true);

            // Phase A — insert A4 skeleton shapes IMMEDIATELY for perceived performance
            const skeletonIds: string[] = [];
            const id = createShapeId();
            editor.createShape<any>({
                id,
                type: 'pdf-page',
                x: 0,
                y: 0,
                props: { w: A4_W, h: A4_H, pageIndex: 1 },
            });
            skeletonIds.push(id);
            editor.zoomToFit({ animation: { duration: 300 } });

            try {
                // Phase B — parse the real PDF (off-main-thread via pdf.js worker)
                const buffer = await file.arrayBuffer();
                pdfCacheManager.clearAll();

                const { numPages, pagesDims } = await pdfWorkerManager.loadDocument(buffer);
                setDocument(file, numPages);

                // Phase C — replace skeletons with real page shapes at correct dimensions
                editor.deleteShapes(skeletonIds as any);

                let currentY = 0;
                const realShapes = pagesDims.map((dims) => {
                    const shapeId = createShapeId();
                    const shape = {
                        id: shapeId,
                        type: 'pdf-page' as const,
                        x: 0,
                        y: currentY,
                        props: { w: dims.width, h: dims.height, pageIndex: dims.pageIndex },
                    };
                    currentY += dims.height + PAGE_GAP;
                    return shape;
                });

                editor.createShapes(realShapes as any);
                setTimeout(() => editor.zoomToFit({ animation: { duration: 500 } }), 50);
            } catch (err) {
                console.error('[TldrawCanvas] PDF load failed:', err);
                editor.deleteShapes(skeletonIds as any);
            } finally {
                setUploading(false);
            }
        },
        [setUploading, setDocument]
    );

    const handleMount = useCallback(
        (editor: Editor) => {
            editorRef.current = editor;
            setEditorReady(true);
            (window as any).__TEST_IS_READY__ = true;

            // Cascade-delete pins when their parent PDF page is removed
            editor.sideEffects.registerBeforeDeleteHandler('shape', (shape: any) => {
                if (shape.type === 'pdf-page') {
                    const pins = editor
                        .getCurrentPageShapes()
                        .filter((s) => (s as any).type === 'pin' && (s as any).meta?.boundShapeId === shape.id);
                    if (pins.length > 0) editor.deleteShapes(pins.map((p) => p.id));
                }
            });
        },
        []
    );

    return (
        <EditorContext.Provider value={editorReady ? editorRef.current : null}>
            {/* Full-screen canvas */}
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>

                <Tldraw
                    onMount={handleMount}
                    shapeUtils={customShapeUtils}
                    tools={customTools}
                    bindingUtils={customBindingUtils}
                    hideUi
                >
                    {/* These components live INSIDE <Tldraw> to access useEditor() */}
                    <ZoomSyncManager />
                    <DropZone onPdfFile={processPdfFile} />
                    {children}
                </Tldraw>

                {/*
          Toolbar & CameraActionBar are rendered OUTSIDE <Tldraw>
          so they are NOT intercepted by tldraw's pointer event system.
          They receive the editor via EditorContext.
          position: fixed ensures they float above everything regardless of z-index.
        */}
                {editorReady && (
                    <>
                        <Toolbar />
                        <CameraActionBar />
                    </>
                )}
            </div>
        </EditorContext.Provider>
    );
}
