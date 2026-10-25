import type { ReactNode } from 'react';

const SHAPES = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 000 12h3" />
    </>
  ),
  select: <path d="M5 3l14 7-6 2-2 6z" />,
  player: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21c0-4 3-7 7-7" />
      <path d="M18 14v6M15 17h6" />
    </>
  ),
  draw: (
    <>
      <path d="M3 19c5 0 3-8 9-8s4-7 9-7" />
      <path d="M17 2l4 2-2 4" />
    </>
  ),
  erase: (
    <>
      <path d="M20 20H9l-5-5a2 2 0 010-3l8-8a2 2 0 013 0l5 5a2 2 0 010 3l-7 8" />
      <path d="M8 11l6 6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20l1-4L16 5l3 3L8 19z" />
      <path d="M14 7l3 3" />
    </>
  ),
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" />,
  pause: <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" />,
  prev: (
    <>
      <path d="M6 5v14" />
      <path d="M19 5l-9 7 9 7z" fill="currentColor" />
    </>
  ),
  next: (
    <>
      <path d="M18 5v14" />
      <path d="M5 5l9 7-9 7z" fill="currentColor" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 10-3 6.2" />
      <path d="M20 4v6h-6" />
    </>
  ),
  steps: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  timing: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </>
  ),
  inspect: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pen: (
    <>
      <path d="M14 4l6 6-9 9H5v-6z" />
      <path d="M12 6l6 6" />
    </>
  ),
  laser: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof SHAPES;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="svg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[name]}
    </svg>
  );
}

/** Mini previews of the five line styles, matching how they are drawn on the ice. */
export function LineGlyph({ kind }: { kind: 'skate' | 'carry' | 'back' | 'pass' | 'shot' }) {
  const head = <path d="M17 12l-4-3v6z" fill="currentColor" stroke="none" />;
  return (
    <svg className="svg-icon line-glyph" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      {kind === 'skate' && <path d="M1 12h13" strokeDasharray="3 2.4" />}
      {kind === 'carry' && <path d="M1 12q2.2-4.5 4.5 0t4.5 0 4 0" />}
      {kind === 'back' && <path d="M1 12h12" strokeDasharray="0.1 3.4" strokeLinecap="round" strokeWidth={2.6} />}
      {kind === 'pass' && (
        <>
          <path d="M1 10h13M1 14h13" strokeWidth={1.4} />
        </>
      )}
      {kind === 'shot' && <path d="M1 12h13" strokeWidth={3.4} />}
      {kind === 'back' ? (
        <path d="M18 7v10" strokeLinecap="round" />
      ) : kind === 'shot' ? (
        <path d="M20 12l-6-5v10z" fill="currentColor" stroke="none" />
      ) : (
        head
      )}
    </svg>
  );
}
