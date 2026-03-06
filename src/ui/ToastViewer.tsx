import { useEffect } from 'react';
import { useAppStore, ToastMessage } from '../state/useAppStore';

function ToastItem({ toast }: { toast: ToastMessage }) {
    const removeToast = useAppStore(s => s.removeToast);

    useEffect(() => {
        const timer = setTimeout(() => {
            removeToast(toast.id);
        }, 3500);
        return () => clearTimeout(timer);
    }, [toast.id, removeToast]);

    const bgColors = {
        'info': 'bg-blue-50 border-blue-200 text-blue-800',
        'error': 'bg-red-50 border-red-200 text-red-800',
        'success': 'bg-green-50 border-green-200 text-green-800'
    };

    return (
        <div data-testid="toast-message" style={{ pointerEvents: 'auto' }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in slide-in-from-bottom-5 fade-in ${bgColors[toast.type]}`}>
            <span className="text-sm font-semibold">{toast.message}</span>
            <button
                onClick={() => removeToast(toast.id)}
                className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
            >
                ✕
            </button>
        </div>
    );
}

export function ToastViewer() {
    const toasts = useAppStore(s => s.toasts);

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                pointerEvents: 'none'
            }}
        >
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} />
            ))}
        </div>
    );
}
