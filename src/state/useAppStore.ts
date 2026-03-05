import { create } from 'zustand';
import { TLShapeId } from 'tldraw';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'info' | 'error' | 'success';
}

interface AppState {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    activePinId: string | null;
    setActivePin: (id: string | null) => void;
    isUploading: boolean;
    setUploading: (uploading: boolean) => void;
    // Camera Tool: tracks the active crop box so the floating action bar can render
    cropBoxBounds: { x: number; y: number; w: number; h: number } | null;
    cropShapeId: TLShapeId | null;
    setCropBox: (bounds: { x: number; y: number; w: number; h: number } | null, shapeId: TLShapeId | null) => void;

    // PDF Parsing Progress
    uploadProgress: { loaded: number; total: number } | null;
    setUploadProgress: (progress: { loaded: number; total: number } | null) => void;

    // Toast Notifications
    toasts: ToastMessage[];
    addToast: (message: string, type?: 'info' | 'error' | 'success') => void;
    removeToast: (id: string) => void;
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
    uploadProgress: null,
    setUploadProgress: (progress) => set({ uploadProgress: progress }),

    toasts: [],
    addToast: (message, type = 'info') => set((state) => ({
        toasts: [...state.toasts, { id: Math.random().toString(36).substring(7), message, type }]
    })),
    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),
}));
