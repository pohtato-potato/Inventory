export type Id = string;

export interface Base {
  id: Id;
  updatedAt: number;
  deletedAt?: number;
}

export type FieldKey = 'size' | 'shoeSize' | 'serial' | 'metal' | 'battery';

/** Where a kind sits on the head-to-toe outfit stage, and which layer it is when lanes share (tops). */
export type Lane = 'head' | 'neck' | 'top' | 'waist' | 'bottom' | 'feet' | 'wrist' | 'hand' | 'carry';
export type Layer = 'under' | 'over' | 'outer';

export interface Kind extends Base {
  parentId: Id | null;
  name: string;
  clothing: boolean;
  fields: FieldKey[];
  hideFromWindow?: boolean;
  order: number;
  lane?: Lane;
  layer?: Layer;
  /** Width on the outfit stage; 1 = a tee's width. */
  baseScale?: number;
}

/** familyId null = a family (Red); otherwise a shade inside it (Burgundy). */
export interface Shade extends Base {
  familyId: Id | null;
  name: string;
  hex: string;
  order: number;
}

/** Two levels: homes hold spots. "With me" is fixed. */
export interface Place extends Base {
  homeId: Id | null;
  name: string;
  role: 'home' | 'spot' | 'withme';
  order: number;
}

export type Fit = 'tight' | 'fits' | 'loose';
export type Condition = 'new' | 'good' | 'worn' | 'replace';
export type WearRange = 'never' | '1-5' | '5-20' | '20-50' | '50+';
export type StartWears = { exact: number } | { range: WearRange };

export interface Rough<T> {
  value: T;
  estimate: boolean;
}

export interface Gone {
  on: string;
  how: 'sold' | 'donated' | 'given' | 'thrown';
  to?: string;
  amount?: number;
}

export interface Item extends Base {
  name: string;
  kindId: Id;
  shadeMain?: Id;
  shadeSecond?: Id;
  count: number;
  brand?: string;
  size?: string;
  boughtOn?: Rough<string>;
  shop?: string;
  price?: Rough<number>;
  currency: string;
  condition?: Condition;
  startWears?: StartWears;
  fit?: Fit;
  fitNote?: string;
  tags: string[];
  usualSpotIds: Id[];
  spotId?: Id;
  status: 'owned' | 'gone';
  gone?: Gone;
  needsDetails: boolean;
  /** pending: waiting in the cut-out queue; uncut: the cut-out failed, the photo is kept as taken and a retake is offered;
   *  kept: the owner chose to keep the photo as taken. */
  cutout?: 'pending' | 'done' | 'uncut' | 'kept';
  hideFromWindow?: boolean;
  extra: Record<string, string>;
  createdAt: number;
  /** Where this piece is worn on the outfit stage, when its kind has no lane (asked once, "Where is this worn?"). */
  outfitLane?: Lane;
  /** The owner's size correction on the outfit stage (× the kind's baseScale). */
  outfitScale?: number;
  /** Pieces this one pairs well with (kept on both sides). */
  pairs?: Id[];
  dressCodes?: string[];
}

export interface CloseUp {
  x: number;
  y: number;
  label: string;
}

export interface Photo extends Base {
  /** The owner's id: a piece, an outfit, a wear or a wish. */
  itemId: Id;
  role: 'main' | 'original' | 'extra' | 'selfie' | 'wish';
  blob: Blob;
  w: number;
  h: number;
  closeups?: CloseUp[];
}

export type EventType = 'added' | 'edited' | 'moved' | 'worn' | 'gone' | 'back';

export interface ItemEvent {
  id: Id;
  itemId: Id;
  at: number;
  type: EventType;
  data?: Record<string, unknown>;
}

export interface SavedSearch extends Base {
  name: string;
  query: string;
}

/** My sizes: a body measurement or a brand's size. */
export interface SizeRow extends Base {
  type: 'measure' | 'brand';
  name: string;
  value: string;
  note?: string;
  order: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** What was worn on one local calendar day (YYYY-MM-DD). One wear per day. */
export interface Wear extends Base {
  day: string;
  itemIds: Id[];
  outfitId?: Id;
  note?: string;
}

export interface Outfit extends Base {
  name?: string;
  itemIds: Id[];
  dressCodes: string[];
  createdAt: number;
}

export type Tier = 'now' | 'soon' | 'someday';

export interface Wish extends Base {
  name: string;
  tier: Tier;
  kindId?: Id;
  shadeId?: Id;
  url?: string;
  shop?: string;
  price?: Rough<number>;
  currency: string;
  note?: string;
  forWhom?: string;
  waitUntil?: { date?: string; note?: string };
  status: 'open' | 'bought' | 'dropped';
  itemId?: Id;
  boughtOn?: string;
  glad?: number;
  gladSkipped?: boolean;
  source: 'hand' | 'share' | 'photo' | 'gap';
  createdAt: number;
}
