import { useRef } from 'react';
import type { Item } from '../domain/types';
import { Piece, Window } from './Window';
import { IconCheck } from './icons';

/** Calls onLongPress after 500 ms held still; a normal tap calls onPress. */
export function usePress(onPress?: () => void, onLongPress?: () => void) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { clearTimeout(t.current); t.current = undefined; };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      long.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      if (onLongPress) t.current = setTimeout(() => { long.current = true; navigator.vibrate?.(15); onLongPress(); }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => { if (onLongPress) e.preventDefault(); },
    onClick: () => { if (!long.current) onPress?.(); long.current = false; },
  };
}

/** A piece in a three-across grid: its window, its name under it. Never a price. */
export function Tile({
  item, photo, colour, onPress, onLongPress, selected, selecting = false, index = 0, cut = true,
}: {
  item: Item;
  photo?: string;
  colour?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selecting?: boolean;
  index?: number;
  cut?: boolean;
}) {
  const press = usePress(onPress, onLongPress);
  const gone = item.status === 'gone' || item.deletedAt !== undefined;
  const label = `${item.name}${item.count > 1 ? `, ${item.count} of them` : ''}${selecting ? (selected ? ', selected' : ', not selected') : ''}`;
  return (
    <div className="tile-cell">
      <Window
        as="button"
        type="button"
        colour={colour}
        lit={!gone && (!selecting || !!selected)}
        delay={Math.min(index, 12) * 50}
        className={`tile${selected ? ' sel' : ''}`}
        aria-label={label}
        aria-pressed={selecting ? !!selected : undefined}
        {...press}
      >
        <Piece src={photo} cut={cut} />
        {item.count > 1 && <span className="tile-count">×{item.count}</span>}
        {selected && <span className="tick"><IconCheck /></span>}
      </Window>
      <p className="lbl" aria-hidden="true">{item.name}</p>
    </div>
  );
}
