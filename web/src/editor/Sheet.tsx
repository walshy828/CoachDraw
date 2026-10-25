import type { ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';

export type SheetTab = 'steps' | 'timing' | 'inspect' | 'details';

const TABS: { id: SheetTab; label: string; icon: IconName }[] = [
  { id: 'steps', label: 'Steps', icon: 'steps' },
  { id: 'timing', label: 'Timing', icon: 'timing' },
  { id: 'inspect', label: 'Selected', icon: 'inspect' },
  { id: 'details', label: 'Details', icon: 'info' },
];

/**
 * Side panel on wide screens, bottom sheet on phones. It is not modal: the stage makes room for it, so the
 * ice stays visible and tappable while it is open.
 */
export function Sheet({ tab, onTab, onClose, children }: { tab: SheetTab; onTab: (t: SheetTab) => void; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="sheet" aria-label="Drill panels">
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <div className="sheet-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => onTab(t.id)}>
              <Icon name={t.icon} size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <Icon name="close" />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </aside>
  );
}
