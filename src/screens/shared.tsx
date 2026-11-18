import type { ReactNode } from 'react';
import type { Trees, Thumb } from '../db/hooks';
import type { Id, Item, Kind, Place, Shade } from '../domain/types';
import { back, go } from '../router';
import { keepUncut } from '../photo/conveyor';
import { IconBack, IconCalendar } from '../ui/icons';
import { kindColour, kindGroup } from '../domain/kinds';
import { Cut, Swatch } from '../ui/Swatch';
import { NoPhoto } from '../ui/kindIcons';
import { floodTo } from '../ui/flood';

/** A thing's colour: its main shade, or, with none, its kind's colour (the owner picks one for a thing with no photo). */
export function pieceColour(item: Item, trees: { shades: Shade[]; kinds: Kind[] }): string {
  return trees.shades.find((s) => s.id === item.shadeMain)?.hex ?? kindColour(item.kindId, trees.kinds);
}

/** Opens a thing: its colour floods the screen from the tap. */
export function openItem(id: Id): void {
  floodTo(() => go('/piece', { id }));
}

export function byId<T extends { id: Id }>(list: T[]): Map<Id, T> {
  return new Map(list.map((x) => [x.id, x]));
}

export function kindName(id: Id, kinds: Kind[]): string {
  return kinds.find((k) => k.id === id)?.name ?? 'Other';
}

export function placeLabel(id: Id | undefined, places: Place[]): string {
  if (!id) return 'No spot';
  const p = places.find((x) => x.id === id);
  if (!p) return 'No spot';
  if (p.role !== 'spot') return p.name;
  return p.name;
}

/** Spots grouped under their homes, in order, then "With me". */
export function homesWithSpots(places: Place[]): { home: Place; spots: Place[] }[] {
  const homes = places.filter((p) => p.role === 'home').sort((a, b) => a.order - b.order);
  return homes.map((home) => ({ home, spots: places.filter((p) => p.role === 'spot' && p.homeId === home.id).sort((a, b) => a.order - b.order) }));
}

export function SubTop({ title, right, onBack, small = false }: { title: string; right?: ReactNode; onBack?: () => void; small?: boolean }) {
  return (
    <div className="top sub">
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack ?? (() => back())}>
        <IconBack size={24} />
      </button>
      <h1 className={small ? 'top-small' : 'title'}>{title}</h1>
      <span className="top-right">{right}</span>
    </div>
  );
}

/** A screen's own title, with buttons on the right. */
export function Top({ title, right, sub }: { title: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="top">
      <h1 className="title">{title}</h1>
      {sub}
      <span className="top-right">{right}</span>
    </div>
  );
}

export type { Trees, Thumb };

/** After a failed cut-out: say so plainly and offer Retake, Keep as it is, or Fix it by tapping. */
export function UncutNote({ item }: { item: Item }) {
  if (item.cutout !== 'uncut') return null;
  return (
    <div className="uncut-note" role="status">
      <p>Couldn't separate this piece from the background. Try a plain surface.</p>
      <div className="uncut-actions">
        <button type="button" className="acc wide" onClick={() => go('/add', { retake: item.id })}>Retake</button>
        <button type="button" className="ghost" onClick={() => void keepUncut(item.id)}>Keep as it is</button>
        <button type="button" className="ghost" onClick={() => go('/fix', { id: item.id })}>Fix it by tapping</button>
      </div>
    </div>
  );
}

/** The exact day, from the phone's own date picker. Writes "12 Nov 2026" into the text field, so it can still be edited. */
export function DayPicker({ value, onPick, future = false, label = 'Pick the exact day' }: { value: string; onPick: (day: string) => void; future?: boolean; label?: string }) {
  const today = new Date();
  const max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return (
    <label className="day-pick" aria-label={label}>
      <IconCalendar />
      <input type="date" value={value} {...(future ? { min: max } : { max })} onChange={(e) => { if (e.target.value) onPick(e.target.value); }}
        onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* the browser opens its own picker */ } }} />
    </label>
  );
}


/** A thing in a small square on its colour (Home, a wish, an outfit's photo): no name, just the thing. */
export function Mini({ item, thumb, trees, size = 48, onPress }: { item: Item; thumb?: Thumb; trees: { shades: Shade[]; kinds: Kind[] }; size?: number; onPress?: () => void }) {
  const gone = item.status === 'gone' || item.deletedAt !== undefined;
  const inner = thumb ? <Cut src={thumb.url} cut={thumb.cut} /> : <NoPhoto group={kindGroup(item.kindId, trees.kinds)} size={Math.round(size * 0.5)} />;
  const style = { width: size, height: size };
  return onPress ? (
    <Swatch as="button" type="button" className="mini" colour={pieceColour(item, trees)} dim={gone} style={style} aria-label={item.name} onClick={onPress}>{inner}</Swatch>
  ) : (
    <Swatch className="mini" colour={pieceColour(item, trees)} dim={gone} style={style} aria-hidden="true">{inner}</Swatch>
  );
}
