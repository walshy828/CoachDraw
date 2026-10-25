import { forwardRef } from 'react';
import { buildTimeline } from '../../../shared/playback';
import type { DrillDoc, DrillMeta } from '../../../shared/types';
import { DrillView } from '../rink/DrillView';

/** Static, print-friendly view of a drill: diagram with numbered steps, step list and notes. */
export const DrillSheet = forwardRef<SVGSVGElement, { meta: DrillMeta; doc: DrillDoc; className?: string }>(
  function DrillSheet({ meta, doc, className }, ref) {
    const frame = buildTimeline(doc).startFrames[0];
    return (
      <article className={`print-sheet ${className ?? ''}`}>
        <h1>{meta.name}</h1>
        <p className="sheet-meta">
          {[meta.category, meta.ageGroup, meta.durationMin ? `${meta.durationMin} min` : '', meta.tags.join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {meta.description && <p>{meta.description}</p>}
        <DrillView ref={ref} doc={doc} view={meta.rinkView} frame={frame} badges className="sheet-rink" />
        <ol className="sheet-steps">
          {doc.steps.map((s) => (
            <li key={s.id}>
              <b>{s.title}</b>
              {s.caption && <span> — {s.caption}</span>}
            </li>
          ))}
        </ol>
        {meta.notes && (
          <>
            <h2>Notes</h2>
            <p className="pre">{meta.notes}</p>
          </>
        )}
      </article>
    );
  },
);
