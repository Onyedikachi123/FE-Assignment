'use client';

import { useEffect, useState } from 'react';
import { useEditorInstance } from './EditorContext';
import { Box, createShapeId } from 'tldraw';
import { executeCropExport } from './tools/CameraExport';
import { MapPin, Camera } from 'lucide-react';
import { useAppStore } from '../../state/useAppStore';

/**
 * SelectionActionBar
 * Floating contextual menu for the Select tool.
 * Provides easy access to Pin and Camera actions based on the current selection.
 */
export function SelectionActionBar() {
    const editor = useEditorInstance();
    const [bounds, setBounds] = useState<Box | null>(null);
    const [selectionCount, setSelectionCount] = useState(0);

    useEffect(() => {
        if (!editor) return;

        const sync = () => {
            const selectedIds = editor.getSelectedShapeIds();
            setSelectionCount(selectedIds.length);
            if (selectedIds.length > 0) {
                setBounds(editor.getSelectionPageBounds());
            } else {
                setBounds(null);
            }
        };

        const unsubscribe = editor.store.listen(sync);
        return () => unsubscribe();
    }, [editor]);

    if (!editor || !bounds || selectionCount === 0) return null;

    // Convert page coordinates to screen coordinates
    const selectionScreenPos = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
    const selectionWidth = bounds.width * editor.getCamera().z;

    const handlePin = () => {
        const selection = editor.getSelectedShapes();
        if (selection.length < 2) {
            useAppStore.getState().addToast('Select at least 2 shapes to pin.', 'info');
            return;
        }

        const pinId = editor.createShape({
            id: createShapeId(),
            type: 'pin',
            x: bounds.center.x,
            y: bounds.center.y,
            props: { attachedShapeIds: selection.map(s => s.id) }
        } as any);

        selection.forEach(s => {
            editor.createBinding({
                type: 'pin-attach',
                fromId: pinId,
                toId: s.id,
                props: { relativeOffset: { x: s.x - bounds.center.x, y: s.y - bounds.center.y }, pinShapeId: pinId }
            } as any);
        });

        useAppStore.getState().addToast(`Pinned ${selection.length} shapes together.`, 'success');
        editor.selectNone();
    };

    const handleCamera = () => {
        // 🎯 IMMEDIATE DOWNLOAD on selection
        executeCropExport(editor, {
            x: bounds.minX - 20,
            y: bounds.minY - 20,
            w: bounds.width + 40,
            h: bounds.height + 40
        }, 'download').catch((err: any) => console.error('[SelectionActionBar] Quick capture failed:', err));

        editor.selectNone();
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: selectionScreenPos.y - 60,
                left: selectionScreenPos.x + (selectionWidth / 2),
                transform: 'translateX(-50%)',
                zIndex: 1000,
                display: 'flex',
                gap: 8,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                padding: '8px 16px',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                pointerEvents: 'all',
                animation: 'slideUp 0.2s ease-out'
            }}
        >
            <button
                onClick={handlePin}
                title="Pin these shapes together"
                disabled={selectionCount < 2}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: selectionCount < 2 ? 'transparent' : '#f0fdf4',
                    color: selectionCount < 2 ? '#94a3b8' : '#15803d',
                    border: 'none', padding: '6px 12px', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: selectionCount < 2 ? 'default' : 'pointer'
                }}
            >
                <MapPin size={14} />
                Pin Selection
            </button>
            <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
            <button
                onClick={handleCamera}
                title="Create camera region here"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#eef2ff', color: '#4338ca',
                    border: 'none', padding: '6px 12px', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer'
                }}
            >
                <Camera size={14} />
                Capture Area
            </button>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(10px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
