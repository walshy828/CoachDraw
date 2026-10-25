import { useLayoutEffect, useEffect, useRef, useState } from 'react';

export type MenuEntry =
  | { type: 'header'; label: string }
  | { type: 'chips'; items: { label: string; title?: string; disabled?: boolean; active?: boolean; onClick: () => void }[] }
  | { type: 'item'; label: string; danger?: boolean; disabled?: boolean; onClick: () => void };

export function ContextMenu({ x, y, entries, onClose }: { x: number; y: number; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const openedAt = useRef(Date.now());
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // never sit under the fingertip: below the touch point if it fits, else above, else beside it
    const gap = 22;
    const room = { below: window.innerHeight - 8 - (y + gap), above: y - gap - 8 };
    const clampTop = (t: number) => Math.max(8, Math.min(t, window.innerHeight - r.height - 8));
    const centered = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));
    if (room.below >= r.height) setPos({ left: centered, top: y + gap });
    else if (room.above >= r.height) setPos({ left: centered, top: y - gap - r.height });
    else {
      const right = x + gap + r.width <= window.innerWidth - 8;
      setPos({ left: right ? x + gap : Math.max(8, x - gap - r.width), top: clampTop(y - r.height / 2) });
    }
  }, [x, y, entries]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const run = (fn: () => void) => () => {
    // the click that follows the tap which opened this menu can land on an item under the finger
    if (Date.now() - openedAt.current < 350) return;
    onClose();
    fn();
  };

  return (
    <div ref={ref} className="ctx-menu" role="menu" style={pos} onContextMenu={(e) => e.preventDefault()}>
      {entries.map((e, i) =>
        e.type === 'header' ? (
          <h5 key={i}>{e.label}</h5>
        ) : e.type === 'chips' ? (
          <div key={i} className="ctx-chips">
            {e.items.map((c) => (
              <button key={c.label} role="menuitem" className={c.active ? 'on' : ''} title={c.title} disabled={c.disabled} onClick={run(c.onClick)}>
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <button key={i} role="menuitem" className={`ctx-item ${e.danger ? 'danger' : ''}`} disabled={e.disabled} onClick={run(e.onClick)}>
            {e.label}
          </button>
        ),
      )}
    </div>
  );
}
