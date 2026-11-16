import type { Thumb } from '../db/hooks';
import { STAGE_ASPECT, type Placed } from '../domain/outfit';
import type { Id } from '../domain/types';
import { Window } from './Window';

/**
 * An outfit standing head to toe in one tall window, lit by its top. Pieces keep their true sizes;
 * a piece that is gone is drawn grey with "gone" under it.
 */
export function Stage({
  placed, photos, height, light, label, delay = 0, className = '', width,
}: {
  placed: Placed[];
  photos: Map<Id, Thumb>;
  height: number;
  light?: string;
  label: string;
  delay?: number;
  className?: string;
  /** A wider window (the stage stays its true shape, centred in it). */
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
    <Window colour={light} delay={delay} className={`stage ${className}`} style={{ width: width ?? box, height }} role="img" aria-label={label}>
      {width ? <span className="stage-box" style={{ width: box }}>{pieces}</span> : pieces}
    </Window>
  );
}
