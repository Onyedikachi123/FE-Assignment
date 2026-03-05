import { create } from 'zustand';

interface DocState {
    currentPdfFile: File | null;
    pageCount: number;
    setDocument: (file: File | null, count: number) => void;
}

export const useDocStore = create<DocState>((set) => ({
    currentPdfFile: null,
    pageCount: 0,
    setDocument: (file, count) => set({ currentPdfFile: file, pageCount: count }),
}));
