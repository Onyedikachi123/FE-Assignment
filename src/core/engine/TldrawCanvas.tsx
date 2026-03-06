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
    TLShapeId,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { PdfPageShapeUtil, TLPdfPageShape } from './shapes/pdf-page/PdfPageShapeUtil';
import { PinShapeUtil } from './shapes/pin/PinShapeUtil';
import { CameraShapeUtil } from './shapes/camera/CameraShapeUtil';
import { PinTool } from './tools/PinTool';
import { CameraTool } from './tools/CameraTool';
import { PinAttachBindingUtil } from './bindings/PinAttachBindingUtil';
import { pdfWorkerManager } from '../pdf/PdfWorkerManager';
import { pdfCacheManager } from '../pdf/PdfCache';
import { useDocStore } from '../../state/useDocStore';
import { useAppStore } from '../../state/useAppStore';
import { EditorContext } from './EditorContext';
import { Toolbar } from '../../ui/Toolbar';
import { ToastViewer } from '../../ui/ToastViewer';
import { SelectionActionBar } from './SelectionActionBar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customShapeUtils: readonly TLShapeUtilConstructor<any>[] = [
    PdfPageShapeUtil,
    PinShapeUtil,
    CameraShapeUtil,
];
const customTools: readonly TLStateNodeConstructor[] = [PinTool, CameraTool];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customBindingUtils: readonly TLBindingUtilConstructor<any>[] = [PinAttachBindingUtil];

const A4_W = 595;
const A4_H = 842;
const PAGE_GAP = 24;

/**
 * ZoomSyncManager
 */
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
                    .filter((s) => (s as unknown as { type: string }).type === 'pdf-page')
                    .filter((s) => {
                        const bounds = editor.getShapePageBounds(s);
                        return bounds && viewportBounds.collides(bounds);
                    })
                    .forEach((s) => {
                        const props = (s as unknown as TLPdfPageShape).props;
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

/**
 * DropZone
 */
function DropZone({ onPdfFile }: { onPdfFile: (file: File) => void }) {
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const handleDrop = (e: DragEvent) => {
            const files = Array.from(e.dataTransfer?.files ?? []);
            const pdf = files.find((f) => f.type === 'application/pdf');
            if (!pdf) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            onPdfFile(pdf);
        };

        document.addEventListener('dragover', handleDragOver, true);
        document.addEventListener('drop', handleDrop, true);

        return () => {
            document.removeEventListener('dragover', handleDragOver, true);
            document.removeEventListener('drop', handleDrop, true);
        };
    }, [onPdfFile]);

    return null;
}

export default function TldrawCanvas({ children }: { children?: React.ReactNode }) {
    const setUploading = useAppStore((s) => s.setUploading);
    const setDocument = useDocStore((s) => s.setDocument);
    const editorRef = useRef<Editor | null>(null);
    const [editorReady, setEditorReady] = useState(false);

    const processPdfFile = useCallback(
        async (file: File) => {
            const editor = editorRef.current;
            if (!editor) return;

            setUploading(true);

            const skeletonIds: TLShapeId[] = [];
            const id = createShapeId();
            editor.createShape({
                id,
                type: 'pdf-page',
                x: 0,
                y: 0,
                props: { w: A4_W, h: A4_H, pageIndex: 1 },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            skeletonIds.push(id);
            editor.zoomToFit({ animation: { duration: 300 } });

            try {
                const buffer = await file.arrayBuffer();
                pdfCacheManager.clearAll();

                const { numPages, pagesDims } = await pdfWorkerManager.loadDocument(buffer, (loaded, total) => {
                    useAppStore.getState().setUploadProgress({ loaded, total });
                });
                setDocument(file, numPages);

                editor.deleteShapes(skeletonIds);

                let currentY = 0;
                const realShapes = pagesDims.map((dims) => {
                    const shapeId = createShapeId();
                    const shape = {
                        id: shapeId,
                        typeName: 'shape' as const,
                        type: 'pdf-page',
                        x: 0,
                        y: currentY,
                        rotation: 0,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        index: 'a1' as any,
                        parentId: editor.getCurrentPageId(),
                        props: { w: dims.width, h: dims.height, pageIndex: dims.pageIndex },
                        meta: {}
                    };
                    currentY += dims.height + PAGE_GAP;
                    return shape;
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                editor.createShapes(realShapes as any);
                setTimeout(() => editor.zoomToFit({ animation: { duration: 500 } }), 50);
                useAppStore.getState().addToast('PDF loaded successfully', 'success');
            } catch (err) {
                console.error('[TldrawCanvas] PDF load failed:', err);
                editor.deleteShapes(skeletonIds);
                useAppStore.getState().addToast('Failed to load PDF. It might be encrypted or corrupted.', 'error');
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__TEST_IS_READY__ = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).editor = editor;

            editor.sideEffects.registerBeforeDeleteHandler('shape', (shape) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((shape as any).type === 'pdf-page') {
                    const pins = editor
                        .getCurrentPageShapes()
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((s: any) => (s as any).type === 'pin' && s.meta?.boundShapeId === shape.id);
                    if (pins.length > 0) editor.deleteShapes(pins.map((p) => p.id));
                }
            });
        },
        []
    );

    return (
        <EditorContext.Provider value={editorReady ? editorRef.current : null}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Tldraw
                    onMount={handleMount}
                    shapeUtils={customShapeUtils}
                    tools={customTools}
                    bindingUtils={customBindingUtils}
                    hideUi
                >
                    <ZoomSyncManager />
                    <DropZone onPdfFile={processPdfFile} />
                    {children}
                </Tldraw>

                {editorReady && (
                    <>
                        <Toolbar />
                        <SelectionActionBar />
                        <ToastViewer />
                    </>
                )}
            </div>
        </EditorContext.Provider >
    );
}
