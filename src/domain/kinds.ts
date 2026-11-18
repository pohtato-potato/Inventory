// Kind colours: six groups, each with its own colour, used on dots, icon wells, chips and Numbers bars.
import type { Id, Kind } from './types';

export type KindGroup = 'clothes' | 'electronics' | 'home' | 'tools' | 'bags' | 'other';

export const KIND_GROUPS: KindGroup[] = ['clothes', 'electronics', 'home', 'tools', 'bags', 'other'];

export const KIND_COLOURS: Record<KindGroup, string> = {
  clothes: '#B23A5E',
  electronics: '#2F63D6',
  home: '#7E52C0',
  tools: '#3D7A22',
  bags: '#985A0D',
  other: '#59626D',
};

export const GROUP_NAME: Record<KindGroup, string> = {
  clothes: 'Clothes', electronics: 'Electronics', home: 'Home', tools: 'Tools', bags: 'Bags and luggage', other: 'Other',
};

/** Starter kinds outside clothing, by id (a renamed starter kind keeps its id, so it keeps its colour). */
const BY_ID: Record<string, KindGroup> = {
  'k-o-electronics': 'electronics',
  'k-o-home': 'home',
  'k-o-tools': 'tools',
  'k-o-bags-and-luggage': 'bags',
};

/** The top of a kind's tree. */
export function rootKind(id: Id, kinds: Kind[]): Kind | undefined {
  let k = kinds.find((x) => x.id === id);
  for (let n = 0; k?.parentId && n < 10; n++) k = kinds.find((x) => x.id === k!.parentId) ?? k;
  return k;
}

/** Which of the six groups a kind belongs to: any clothing is Clothes; a kind the owner added is Other. */
export function kindGroup(id: Id, kinds: Kind[]): KindGroup {
  const root = rootKind(id, kinds);
  if (!root) return 'other';
  if (root.clothing) return 'clothes';
  return BY_ID[root.id] ?? 'other';
}

/** The owner's own kind colours (Settings), over the defaults. */
let own: Partial<Record<KindGroup, string>> = {};
export function setOwnKindColours(c: Partial<Record<KindGroup, string>> | undefined): void {
  own = c ?? {};
}

export function groupColour(g: KindGroup): string {
  return own[g] ?? KIND_COLOURS[g];
}

export function kindColour(id: Id, kinds: Kind[]): string {
  return groupColour(kindGroup(id, kinds));
}

/** Colours the owner can give a kind: the six, plus a few more that still carry chalk text. */
export const KIND_PALETTE = ['#B23A5E', '#2F63D6', '#7E52C0', '#3D7A22', '#985A0D', '#59626D', '#A8324A', '#1F7A78', '#8E3F1F', '#5B4FB0', '#2E6E4E', '#7A5A18'];
