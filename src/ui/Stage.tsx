import type { Thumb } from '../db/hooks';
import { STAGE_ASPECT, type Placed } from '../domain/outfit';
import type { Id } from '../domain/types';
import type { CSSProperties } from 'react';
import { itemColour } from '../domain/colour';

/** Vertical bands, one per colour, growing up from the floor (or down from the top). */
export function Bands({ colours, delay = 0, down = false }: { colours: string[]; delay?: number; down?: boolean }) {
  return (
    <span className={`stage-bands${down ? ' down' : ''}`} aria-hidden="true">
      {colours.map((c, i) => <span key={i} style={{ '--c': itemColour(c), '--d': `${delay + i * 70}ms` } as CSSProperties} />)}
    </span>
  );
}

/**
 * An outfit standing head to toe on bands of its pieces' colours. Pieces keep their true sizes;
 * a piece that is gone is drawn grey with "gone" under it.
 */
export function Stage({
  placed, photos, height, colours, label, delay = 0, className = '', width,
}: {
  placed: Placed[];
  photos: Map<Id, Thumb>;
  height: number;
  /** The pieces' colours, top first: one band each. */
  colours: string[];
  label: string;
  delay?: number;
  className?: string;
  /** A wider stage (the pieces stays its true shape, centred in it). */
  width?: number | string;
}) {
  const box = Math.round(height * STAGE_ASPECT);
  const pieces = placed.map((p) => {
        const t = photos.get(p.itemId);
        if (!t) return null;
        return (
          <span
            key={p.itemId}
            className={`stage-pc${p.gone ? ' gone' : ''}`}
            style={{ left: `${(p.x - p.w / 2) * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, zIndex: p.z + 1 }}
          >
            <img className={`pc${t.cut ? '' : ' uncut'}`} src={t.url} alt="" draggable={false} decoding="async" />
            {p.gone && <span className="stage-gone">gone</span>}
          </span>
        );
  });
  return (
    <div className={`stage ${className}`} style={{ width: width ?? box, height, '--d': `${delay}ms` } as CSSProperties} role="img" aria-label={label}>
      <Bands colours={colours.length ? colours : ['#59626D']} delay={delay} />
      {width ? <span className="stage-box" style={{ width: box }}>{pieces}</span> : pieces}
    </div>
  );
}
