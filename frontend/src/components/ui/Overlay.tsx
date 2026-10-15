import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ---------- focus helpers ---------- */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDialogBehaviour(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const a = items[0], b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);
}

/* ---------- Modal ---------- */

export const Modal: React.FC<{
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg'; description?: string;
}> = ({ open, onClose, title, children, footer, size = 'md', description }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-forest/60 backdrop-blur-[2px] p-0 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`w-full ${width} bg-cream rounded-t-3xl sm:rounded-3xl shadow-[var(--shadow-lift)] max-h-[92vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
          <div>
            <h2 id="modal-title" className="font-display text-2xl text-brand">{title}</h2>
            {description && <p className="text-muted text-sm mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 rounded-full hover:bg-sand" aria-label={t('form.close')}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean; title: string; text: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean; busy?: boolean; children?: React.ReactNode;
}> = ({ open, title, text, confirmLabel, onConfirm, onClose, danger, busy, children }) => {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<>
      <button type="button" className="btn btn-outline" onClick={onClose}>{t('form.cancel')}</button>
      <button type="button" className={`btn ${danger ? 'bg-danger text-white hover:bg-[#8f1f18]' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} data-autofocus>{confirmLabel}</button>
    </>}>
      <p className="text-ink/80">{text}</p>
      {children}
    </Modal>
  );
};

/* ---------- Side drawer ---------- */

export const Drawer: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; side?: 'right' | 'left' }> = ({ open, onClose, title, children, footer, side = 'right' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-forest/50" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title" className={`absolute top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full w-full max-w-lg bg-cream shadow-[var(--shadow-lift)] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <h2 id="drawer-title" className="font-display text-2xl text-brand">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-sand" aria-label={t('form.close')}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex flex-wrap gap-3 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

/* ---------- Toasts ---------- */

type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems(list => [...list, { id, kind, text }]);
    setTimeout(() => setItems(list => list.filter(x => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[90] bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96" role="status" aria-live="polite">
        {items.map(x => (
          <div key={x.id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)] text-sm font-semibold ${x.kind === 'error' ? 'bg-danger text-white' : x.kind === 'info' ? 'bg-ink text-white' : 'bg-forest text-white'}`}>
            {x.kind === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : x.kind === 'info' ? <Info className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0 text-gold" />}
            <span>{x.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

/* ---------- Dropdown (menu) ---------- */

export function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
