'use client';

import { useEffect, useState } from 'react';
import { Camera, Clipboard, Download, X } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { executeCropExport } from '../core/engine/tools/CameraExport';
import { useEditorInstance } from '../core/engine/EditorContext';

/**
 * CameraActionBar
 */
export function CameraActionBar() {
    const editor = useEditorInstance();
    const cropBoxBounds = useAppStore((s) => s.cropBoxBounds);
    const cropShapeId = useAppStore((s) => s.cropShapeId);
    const setCropBox = useAppStore((s) => s.setCropBox);

    const [isExporting, setIsExporting] = useState(false);
    const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!editor || !cropBoxBounds) {
            setScreenPos(null);
            return;
        }

        const updateScreenPos = () => {
            setScreenPos(
                editor.pageToScreen({
                    x: cropBoxBounds.x + cropBoxBounds.w,
                    y: cropBoxBounds.y + cropBoxBounds.h,
                })
            );
        };

        updateScreenPos();
        const unsubscribe = editor.store.listen(updateScreenPos);

        return unsubscribe;
    }, [editor, cropBoxBounds]);

    if (!editor || !cropBoxBounds || !screenPos) return null;

    const cancel = () => {
        if (cropShapeId) editor.deleteShape(cropShapeId);
        setCropBox(null, null);
        editor.setCurrentTool('select');
    };

    const exportAs = async (target: 'download' | 'clipboard') => {
        setIsExporting(true);
        const addToast = useAppStore.getState().addToast;
        try {
            await executeCropExport(editor, cropBoxBounds, target);
        } catch (e) {
            console.error('[CameraActionBar] Export error:', e);
            addToast('Export failed. Please try again.', 'error');
        } finally {
            setIsExporting(false);
            if (cropShapeId) editor.deleteShape(cropShapeId);
            setCropBox(null, null);
            editor.setCurrentTool('select');
        }
    };

    return (
        <div
            data-testid="camera-action-bar"
            style={{
                position: 'fixed',
                left: screenPos.x + 8,
                top: screenPos.y + 8,
                zIndex: 9999,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '8px 12px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
                pointerEvents: 'auto',
            }}
        >
            <Camera size={14} color="#94a3b8" />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginRight: 4 }}>
                {Math.round(cropBoxBounds.w)} × {Math.round(cropBoxBounds.h)}
            </span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

            <button
                onClick={() => exportAs('download')}
                disabled={isExporting}
                title="Save PNG"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#6366f1', color: 'white', border: 'none',
                    borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, opacity: isExporting ? 0.6 : 1,
                }}
            >
                <Download size={13} />
                {isExporting ? 'Exporting…' : 'Save PNG'}
            </button>

            <button
                onClick={() => exportAs('clipboard')}
                disabled={isExporting}
                title="Copy to clipboard"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
            >
                <Clipboard size={13} />
                Copy
            </button>

            <button
                onClick={cancel}
                title="Cancel"
                style={{
                    display: 'flex', alignItems: 'center',
                    background: 'transparent', color: '#94a3b8', border: 'none',
                    borderRadius: 8, padding: '6px', cursor: 'pointer',
                }}
            >
                <X size={14} />
            </button>
        </div>
    );
}
