import type { ReactNode } from 'react';
import type { Trees, Thumb } from '../db/hooks';
import type { Id, Item, Kind, Place, Shade } from '../domain/types';
import { back, go } from '../router';
import { keepUncut } from '../photo/conveyor';
import { IconBack } from '../ui/icons';
import { UNKNOWN_LIGHT } from '../ui/light';

/** The colour that lights a piece's window: its main shade. */
export function pieceColour(item: Item, shades: Shade[]): string {
  return shades.find((s) => s.id === item.shadeMain)?.hex ?? UNKNOWN_LIGHT;
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

export function SubTop({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <div className="top sub">
      <button type="button" className="icon-btn m" aria-label="Back" onClick={onBack ?? (() => back())}>
        <IconBack />
      </button>
      <h1 className="caps" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>{right}</span>
    </div>
  );
}

export type { Trees, Thumb };

/** After a failed cut-out: say so plainly and offer Retake or Keep as it is. */
export function UncutNote({ item }: { item: Item }) {
  if (item.cutout !== 'uncut') return null;
  return (
    <div className="uncut-note" role="status">
      <p>Couldn't separate this piece from the background. Try a plain surface.</p>
      <div className="uncut-actions">
        <button type="button" className="acc" onClick={() => go('/add', { retake: item.id })}>Retake</button>
        <button type="button" className="ghost" onClick={() => void keepUncut(item.id)}>Keep as it is</button>
      </div>
    </div>
  );
}
