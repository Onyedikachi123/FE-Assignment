import { create } from 'zustand';

interface AppState {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    activePinId: string | null;
    setActivePin: (id: string | null) => void;
    isUploading: boolean;
    setUploading: (uploading: boolean) => void;
    // Camera Tool: tracks the active crop box so the floating action bar can render
    cropBoxBounds: { x: number; y: number; w: number; h: number } | null;
    cropShapeId: string | null;
    setCropBox: (bounds: { x: number; y: number; w: number; h: number } | null, shapeId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    isSidebarOpen: true,
    setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    activePinId: null,
    setActivePin: (id) => set({ activePinId: id }),
    isUploading: false,
    setUploading: (uploading) => set({ isUploading: uploading }),
    cropBoxBounds: null,
    cropShapeId: null,
    setCropBox: (bounds, shapeId) => set({ cropBoxBounds: bounds, cropShapeId: shapeId }),
}));
