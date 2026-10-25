import { useLayoutEffect, useRef, useState } from 'react';
import type { RinkView } from '../../../shared/types';
import { viewBoxFor } from '../rink/Rink';

/**
 * Measures the box the ice has to fit in and decides whether turning the rink 90° would make it
 * bigger (a full-length rink on a portrait phone). `override` lets the coach force either way.
 */
export function useFitRotation(view: RinkView, override: boolean | null = null, ready = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [auto, setAuto] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const [, , vw, vh] = viewBoxFor(view);
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const upright = Math.min(width / vw, height / vh);
      const turned = Math.min(width / vh, height / vw);
      setAuto(turned > upright * 1.05);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, ready]);

  return { ref, rotated: override ?? auto, auto };
}
