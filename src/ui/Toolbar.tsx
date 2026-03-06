'use client';

import { useEffect, useState } from 'react';
import { Camera, MapPin, MousePointer2, Square, Upload } from 'lucide-react';
import { useDocStore } from '../state/useDocStore';
import { useAppStore } from '../state/useAppStore';
import { useEditorInstance } from '../core/engine/EditorContext';
import { executeCropExport } from '../core/engine/tools/CameraExport';

/**
 * Toolbar
 *
 * Rendered OUTSIDE <Tldraw> (in TldrawCanvas, after editorReady=true).
 * Uses useEditorInstance() — our own React context — instead of tldraw's
 * useEditor() which only works inside the <Tldraw> component tree.
 *
 * Fixed positioning means it always floats above the canvas regardless
 * of tldraw's internal z-index management.
 */
export function Toolbar() {
    const editor = useEditorInstance();
    const { currentPdfFile, pageCount } = useDocStore();
    const isUploading = useAppStore((s) => s.isUploading);
    const uploadProgress = useAppStore((s) => s.uploadProgress);

    // 'currentToolId' starts as null to satisfy the "from start it should be unclick" requirement.
    // The editor actually defaults to 'select', but the UI won't show it as active until a click.
    const [currentToolId, setCurrentToolId] = useState<string | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Keyboard shortcuts and tool state sync
    useEffect(() => {
        if (!editor) return;

        // Sync tldraw tool state to React state for UI re-rendering
        const unsubscribe = editor.store.listen(() => {
            const toolId = editor.getCurrentToolId();
            if (toolId !== currentToolId) {
                // If it's the first time we see a tool change, or it's not 'select' anymore,
                // we might want to show it. But let's stick to explicit user clicks for high-lighting 'select'.
                setCurrentToolId(toolId);
            }
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch (e.key.toLowerCase()) {
                case 'v': editor.setCurrentTool('select'); setCurrentToolId('select'); break;
                case 'p': editor.setCurrentTool('pin'); setCurrentToolId('pin'); break;
                case 'c': {
                    editor.setCurrentTool('camera');
                    setCurrentToolId('camera');
                    break;
                }
                case 'escape': editor.setCurrentTool('select'); setCurrentToolId('select'); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            unsubscribe();
        };
    }, [editor, currentToolId, hasInteracted]);

    if (!editor) return null;

    const handleToolClick = (toolId: string) => {
        setHasInteracted(true);
        const selection = editor.getSelectedShapes();

        // 🎯 "The Select Tool (V) should also be the one use to create the shapes..."
        // If we have a selection while clicking Pin/Camera, we treat them as IMMEDIATE ACTIONS
        // rather than switching tools.
        if (selection.length > 0) {
            if (toolId === 'pin' && selection.length >= 2) {
                // Create pin at center of selection
                const bounds = editor.getSelectionPageBounds();
                if (bounds) {
                    const pinId = editor.createShape({
                        type: 'pin',
                        x: bounds.center.x,
                        y: bounds.center.y,
                        props: { attachedShapeIds: selection.map(s => s.id) }
                    } as any);
                    // Bind them
                    selection.forEach(s => {
                        editor.createBinding({
                            type: 'pin-attach',
                            fromId: pinId,
                            toId: s.id,
                            props: { relativeOffset: { x: s.x - bounds.center.x, y: s.y - bounds.center.y }, pinShapeId: pinId }
                        } as any);
                    });
                    useAppStore.getState().addToast(`Pinned ${selection.length} shapes.`, 'success');
                    return;
                }
            } else if (toolId === 'camera') {
                // 🎯 IMMEDIATE DOWNLOAD on selection
                const bounds = editor.getSelectionPageBounds();
                if (bounds) {
                    executeCropExport(editor, { x: bounds.minX - 10, y: bounds.minY - 10, w: bounds.width + 20, h: bounds.height + 20 }, 'download')
                        .catch((err: any) => console.error('[Toolbar] Quick capture failed:', err));
                    return;
                }
            }
        }

        // Default: Switch tool
        editor.setCurrentTool(toolId);
        setCurrentToolId(toolId);
    };

    const tools = [
        { id: 'select', icon: <MousePointer2 size={20} />, label: 'Select', shortcut: 'V', disabled: false },
        { id: 'geo', icon: <Square size={20} />, label: 'Rectangle', shortcut: 'R', disabled: false },
        { id: 'pin', icon: <MapPin size={20} />, label: 'Picker', shortcut: 'P', disabled: false },
        { id: 'camera', icon: <Camera size={20} />, label: 'Capture', shortcut: 'C', disabled: false },
    ];

    return (
        <>
            {/* ── Top status bar ─────────────────────────────────────── */}
            <div
                data-testid="top-status-bar"
                style={{
                    position: 'fixed',
                    top: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    padding: '10px 24px',
                    borderRadius: 999,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6)',
                    pointerEvents: 'none', // status bar is display-only
                    whiteSpace: 'nowrap',
                }}
            >
                {isUploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: '#6366f1', animation: 'pulse 1s infinite',
                                }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>
                                    Processing PDF…
                                </span>
                            </div>
                            {uploadProgress && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
                                    {Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%
                                </span>
                            )}
                        </div>
                        {/* Determinate progress bar */}
                        {uploadProgress && (
                            <div style={{ width: '100%', height: 4, background: '#e0e7ff', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${(uploadProgress.loaded / uploadProgress.total) * 100}%`,
                                    height: '100%',
                                    background: '#6366f1',
                                    transition: 'width 0.1s linear'
                                }} />
                            </div>
                        )}
                    </div>
                ) : currentPdfFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                        <span style={{
                            fontSize: 14, fontWeight: 600, color: '#1e293b',
                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {currentPdfFile.name}
                        </span>
                        <span style={{
                            fontSize: 12, fontWeight: 700, color: '#6366f1',
                            padding: '2px 8px', borderRadius: 6,
                            background: '#eef2ff', border: '1px solid #c7d2fe',
                        }}>
                            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        </span>
                    </div>
                ) : (
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer', pointerEvents: 'auto' }}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'application/pdf';
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;

                                // We dispatch a custom synthetic drop event to the document so our existing
                                // DropZone capture-phase listener picks it up and processes the PDF.
                                const dt = new DataTransfer();
                                dt.items.add(file);

                                const dropEvent = new DragEvent('drop', {
                                    bubbles: true,
                                    cancelable: true,
                                    dataTransfer: dt,
                                });

                                document.dispatchEvent(dropEvent);
                            };
                            input.click();
                        }}
                    >
                        <Upload size={16} style={{ color: '#6366f1' }} />
                        Drop or click to open a PDF
                    </div>
                )}
            </div>

            {/* ── Left vertical tool panel ───────────────────────────── */}
            <div
                style={{
                    position: 'fixed',
                    left: 24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    padding: 12,
                    borderRadius: 24,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6)',
                }}
            >
                {tools.map((t) => {
                    const isActive = currentToolId === t.id;
                    return (
                        <button
                            key={t.id}
                            data-testid={`tool-btn-${t.id}`}
                            data-active={isActive}
                            title={`${t.label} (${t.shortcut})`}
                            disabled={t.disabled || isUploading}
                            onClick={() => handleToolClick(t.id)}
                            style={{
                                width: 48,
                                height: 48,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 16,
                                border: 'none',
                                position: 'relative',
                                transition: 'all 0.18s ease',
                                background: (hasInteracted && isActive) ? '#6366f1' : 'transparent',
                                color: (hasInteracted && isActive) ? '#ffffff' : (t.disabled ? '#cbd5e1' : '#64748b'),
                                boxShadow: (hasInteracted && isActive) ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
                                transform: (hasInteracted && isActive) ? 'scale(1.08)' : 'scale(1)',
                                opacity: t.disabled ? 0.5 : 1,
                                cursor: t.disabled ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                                    (e.currentTarget as HTMLElement).style.color = '#1e293b';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = '#64748b';
                                }
                            }}
                        >
                            {t.icon}
                            {/* Keyboard shortcut badge */}
                            <span style={{
                                position: 'absolute',
                                bottom: -2, right: -2,
                                fontSize: 9, fontWeight: 800,
                                padding: '1px 4px', borderRadius: 4,
                                background: (hasInteracted && isActive) ? 'white' : '#e2e8f0',
                                color: (hasInteracted && isActive) ? '#6366f1' : '#64748b',
                                lineHeight: 1.4,
                            }}>
                                {t.shortcut}
                            </span>
                        </button>
                    );
                })}
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
        </>
    );
}
