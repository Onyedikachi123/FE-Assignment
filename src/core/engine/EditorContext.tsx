'use client';

import { createContext, useContext } from 'react';
import { Editor } from 'tldraw';

/**
 * EditorContext
 *
 * Shares the live tldraw Editor instance with React components that are
 * rendered OUTSIDE the <Tldraw> component tree — so they cannot use
 * tldraw's own useEditor() hook.
 *
 * Toolbar and CameraActionBar use this so they can be rendered above the
 * tldraw canvas (fixed positioning, no z-index conflicts, reliable pointer
 * events) while still commanding the editor.
 */
export const EditorContext = createContext<Editor | null>(null);

export function useEditorInstance(): Editor | null {
    return useContext(EditorContext);
}
