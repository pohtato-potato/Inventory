import { useRef } from 'react';
import type { Item } from '../domain/types';
import { Cut, Swatch } from './Swatch';
import { NoPhoto } from './kindIcons';
import type { KindGroup } from '../domain/kinds';
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

/** A thing in a three-across grid: its photo on a darker version of its colour, its name bottom-left. Never a price. */
export function Tile({
  item, photo, colour, group = 'other', onPress, onLongPress, selected, selecting = false, index = 0, cut = true,
}: {
  item: Item;
  photo?: string;
  colour?: string;
  group?: KindGroup;
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
    <Swatch
      as="button"
      type="button"
      colour={colour}
      dim={gone}
      delay={Math.min(index, 14) * 40}
      className={`tile rise${selecting ? ' picking' : ''}${selected ? ' sel' : ''}`}
      aria-label={label}
      aria-pressed={selecting ? !!selected : undefined}
      {...press}
    >
      {photo ? <Cut src={photo} cut={cut} /> : <NoPhoto group={group} size={30} />}
      {item.count > 1 && <span className="tile-count">×{item.count}</span>}
      {selected && <span className="tick"><IconCheck size={18} /></span>}
      <span className="tile-name" aria-hidden="true">{item.name}</span>
    </Swatch>
  );
}
