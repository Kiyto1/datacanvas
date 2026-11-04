import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  /** Which edge of the trigger the panel lines up with. 'end' = inline end (left in RTL). */
  align?: 'start' | 'end';
  width?: string;
}

/** Anchored panel: closes on outside click and Escape, returns focus to the trigger. */
export function Popover({ open, onClose, trigger, children, label, align = 'end', width = 'w-80' }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        root.current?.querySelector<HTMLElement>('[data-popover-trigger] button, [data-popover-trigger]')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={root} className="relative">
      <div data-popover-trigger>{trigger}</div>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`pop absolute top-full z-30 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border border-line-strong bg-surface p-3 shadow-pop ${width} ${align === 'end' ? 'end-0' : 'start-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
