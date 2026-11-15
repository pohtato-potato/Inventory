import { useRef, useState } from 'react';
import { answerGlad, buyWish, dropWish, undoLast, updateWish } from '../db/actions';
import { useItems, useTrees, useWish, useWishes, useWishPhotos, type Thumb } from '../db/hooks';
import { parseRoughPrice } from '../domain/estimate';
import { roughPriceText } from '../domain/format';
import type { Id, Tier, Wish } from '../domain/types';
import { dayKey } from '../domain/wearlog';
import { asksThirtyWears, isWaiting, safeLink, sortWishes, TIERS, waitText } from '../domain/wish';
import { daysBetween } from '../domain/wearlog';
import { bitmapFromFile } from '../photo/camera';
import { shrinkToWebp } from '../photo/cutout';
import { back, go, useRoute } from '../router';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { Piece, Window } from '../ui/Window';
import { DayPicker, kindName, SubTop, type Trees } from './shared';
import { setPendingWishPhoto } from './WishForm';
import { GapHints } from './OwnThis';

const tierLabel = (t: Tier) => TIERS.find((x) => x.value === t)!.label;

const shadeHex = (w: Wish, trees: Trees | undefined) => trees?.shades.find((s) => s.id === w.shadeId)?.hex;
export const shopPrice = (w: Wish) => [w.shop, w.price ? roughPriceText(w.price, w.currency) : ''].filter(Boolean).join(' · ');
const shortDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The wish list: one wish in the window, then the board for Now, Soon or Someday. */
export function Wishes() {
  const { params } = useRoute();
  const tier = (TIERS.some((t) => t.value === params.get('tier')) ? params.get('tier') : 'now') as Tier;
  const wishes = useWishes();
  const thumbs = useWishPhotos();
  const trees = useTrees();
  const items = useItems();
  const [past, setPast] = useState(false);
  if (!wishes || !thumbs) return <main className="screen" aria-busy="true" />;

  const today = dayKey(Date.now());
  const sorted = sortWishes(wishes, today);
  const open = sorted.filter((w) => w.status === 'open');
  const shown = open.filter((w) => w.tier === tier);
  const done = sorted.filter((w) => w.status !== 'open');
  const pick = open.find((w) => !isWaiting(w, today) && thumbs.has(w.id)) ?? open.find((w) => !isWaiting(w, today)) ?? open[0];
  const pickThumb = pick ? thumbs.get(pick.id) : undefined;
  const params0 = tier === 'now' ? {} : { tier };

  return (
    <main className="screen">
      <Window as="section" colour={pick ? shadeHex(pick, trees) : undefined} lit={!!pick} className="hero hero-wish" aria-label="Wishes">
        <div className="top"><h1 className="caps">Wishes</h1></div>
        <div className="hero-count">
          <Numeral value={open.length} className="hero-num" />
          <p className="caps m">on the list</p>
        </div>
        {pick ? (
          <>
            <button type="button" className="hero-piece" aria-label={`${pick.name}, in the window`} onClick={() => go('/wish', { id: pick.id })}>
              {pickThumb ? <Piece src={pickThumb.url} cut={false} /> : <span className="wish-word big">{pick.name}</span>}
            </button>
            <p className="hero-why" aria-hidden="true">
              <span className="m">In the window</span>
              <br />
              <b>{pick.name}</b>
              <br />
              <span className="m">{tierLabel(pick.tier)}</span>
            </p>
          </>
        ) : (
          <div className="hero-empty">
            <p className="name" style={{ fontSize: 24 }}>Nothing wished for yet</p>
            <button type="button" className="acc" onClick={() => go('/wish-new')}>Add a wish</button>
          </div>
        )}
      </Window>

      <Seg label="Which wishes" value={tier} onChange={(t) => go('/wishes', t === 'now' ? {} : { tier: t }, { replace: true })} options={TIERS.map((t) => ({ value: t.value, label: `${t.label} ${open.filter((w) => w.tier === t.value).length}` }))} />
      {shown.length ? (
        <div className="wish-grid">
          {shown.map((w, i) => <WishTile key={w.id} w={w} thumb={thumbs.get(w.id)} colour={shadeHex(w, trees)} today={today} index={i} />)}
        </div>
      ) : (
        <p className="m empty-line">{open.length ? `Nothing in ${tierLabel(tier)}.` : 'Share a product from a shop app, or tap + to add a wish.'}</p>
      )}

      {done.length > 0 && (
        <section className="wish-past">
          <button type="button" className="link" onClick={() => setPast((p) => !p)} aria-expanded={past}>
            {past ? 'Hide bought and let go' : `Bought and let go (${done.length})`}
          </button>
          {past && done.map((w) => (
            <button key={w.id} type="button" className="li" onClick={() => go('/wish', { id: w.id })}>
              <span>{w.name}</span>
              <span className="n">{w.status === 'bought' ? `Bought${w.boughtOn ? ` ${shortDay(w.boughtOn)}` : ''}` : 'Not any more'}</span>
            </button>
          ))}
        </section>
      )}

      {items && trees && <GapHints items={items} wishes={wishes} trees={trees} />}

      <AddWishSheet open={params.get('add') === '1'} onClose={() => go('/wishes', params0, { replace: true })} />
    </main>
  );
}

function WishTile({ w, thumb, colour, today, index }: { w: Wish; thumb?: Thumb; colour?: string; today: string; index: number }) {
  const wait = waitText(w, today);
  const line = shopPrice(w);
  return (
    <div className={`wish-cell${wait ? ' waiting' : ''}`}>
      <Window as="button" type="button" colour={colour} lit={!wait && !!thumb} delay={Math.min(index, 12) * 50} className="wish-tile"
        aria-label={[w.name, line, wait].filter(Boolean).join(', ')} onClick={() => go('/wish', { id: w.id })}>
        {thumb ? <Piece src={thumb.url} cut={false} /> : <span className="wish-word" aria-hidden="true">{w.name}</span>}
      </Window>
      <p className="wish-name" aria-hidden="true">{w.name}</p>
      {line && <p className="m sm" aria-hidden="true">{line}</p>}
      {wait && <p className="m sm" aria-hidden="true">{wait}</p>}
    </div>
  );
}

/** The + on the Wishes tab: type a wish in, or start from a photo (a shop's screenshot). */
function AddWishSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const pickPhoto = async (f: File) => {
    try {
      const bmp = await bitmapFromFile(f);
      const shot = await shrinkToWebp(bmp);
      bmp.close();
      setPendingWishPhoto(shot);
      go('/wish-new', { source: 'photo' }, { replace: true });
    } catch {
      showToast("Couldn't open that photo");
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Add a wish">
      <p className="name" style={{ fontSize: 22, paddingBottom: 10 }}>Add a wish</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="ghost" onClick={() => go('/wish-new', undefined, { replace: true })}>Type it in</button>
        <button type="button" className="ghost" onClick={() => file.current?.click()}>Photo from a shop</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickPhoto(f); e.target.value = ''; }} />
        <button type="button" className="ghost" onClick={() => go('/own', undefined, { replace: true })}>Do I already own this?</button>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

/** One wish: what it is, and what to do about it. */
export function WishPage() {
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const w = useWish(id);
  const thumbs = useWishPhotos();
  const trees = useTrees();
  const [buying, setBuying] = useState(false);
  const [asking, setAsking] = useState(false);
  const [moving, setMoving] = useState(false);
  if (w === undefined || !thumbs || !trees) return <main className="screen" aria-busy="true" />;
  if (!w) {
    return (
      <main className="screen">
        <SubTop title="Wish" />
        <p className="empty-line m">This wish is not here any more.</p>
      </main>
    );
  }
  const today = dayKey(Date.now());
  const thumb = thumbs.get(w.id);
  const link = safeLink(w.url);
  const wait = waitText(w, today);
  const kind = w.kindId ? kindName(w.kindId, trees.kinds) : '';
  const shade = trees.shades.find((s) => s.id === w.shadeId);

  return (
    <main className="screen wish-page">
      <SubTop title="Wish" right={w.status === 'open' ? <button type="button" className="link" onClick={() => go('/wish-new', { id: w.id })}>Change</button> : undefined} />
      <Window className="wish-hero" colour={shade?.hex} lit={!!thumb && w.status === 'open'}>
        {thumb ? <Piece src={thumb.url} cut={false} alt={w.name} /> : <span className="wish-word big" aria-hidden="true">{w.name}</span>}
      </Window>
      <div className="wish-body">
        <h2 className="name wish-title">{w.name}</h2>
        <p className="m">{[tierLabel(w.tier), kind, shade?.name].filter(Boolean).join(' · ')}</p>
        {shopPrice(w) && <p>{shopPrice(w)}</p>}
        {w.forWhom && <p>For {w.forWhom}</p>}
        {wait && <p className="m">{wait}</p>}
        {w.note && <p className="wish-note">{w.note}</p>}

        {w.status === 'open' && (
          <div className="wish-actions">
            <button type="button" className="acc" onClick={() => (asksThirtyWears(w, trees.kinds) ? setAsking(true) : setBuying(true))}>Bought</button>
            {link && <a className="ghost" href={link} target="_blank" rel="noopener noreferrer">Open the shop page</a>}
            <button type="button" className="ghost" onClick={() => go('/own', { kind: w.kindId, shade: shade?.familyId ?? w.shadeId })}>Do I already own this?</button>
            <button type="button" className="ghost" onClick={() => setMoving(true)}>Move to…</button>
            <button type="button" className="ghost" onClick={async () => { await dropWish(w.id); showToast('Taken off your wishes', () => void undoLast()); back('/wishes'); }}>Not any more</button>
          </div>
        )}
        {w.status === 'bought' && (
          <div className="wish-actions">
            <p>Bought{w.boughtOn ? ` on ${shortDay(w.boughtOn)}` : ''}</p>
            {w.itemId && <button type="button" className="ghost" onClick={() => go('/piece', { id: w.itemId })}>Open the piece</button>}
          </div>
        )}
        {w.status === 'dropped' && (
          <div className="wish-actions">
            <p className="m">You took this off your wishes.</p>
            <button type="button" className="ghost" onClick={async () => { await updateWish(w.id, { status: 'open' }); showToast('Back on your wishes', () => void undoLast()); }}>Want it again</button>
          </div>
        )}
      </div>
      <Sheet open={asking} onClose={() => setAsking(false)} label="Will you wear it 30 times?">
        <div style={{ display: 'grid', gap: 8 }}>
          <p className="name" style={{ fontSize: 24, paddingBottom: 6 }}>Will you wear it 30 times?</p>
          <button type="button" className="ghost" onClick={() => { setAsking(false); setBuying(true); }}>Yes, I will</button>
          <button type="button" className="ghost" onClick={() => setAsking(false)}>Not sure, keep it as a wish</button>
          <button type="button" className="ghost" onClick={() => { setAsking(false); setBuying(true); }}>Buying it anyway</button>
        </div>
      </Sheet>
      <BuySheet open={buying} onClose={() => setBuying(false)} wish={w} />
      <Sheet open={moving} onClose={() => setMoving(false)} label="Move to">
        <p className="name" style={{ fontSize: 22, paddingBottom: 10 }}>Move to…</p>
        <Chips label="Move to" value={w.tier} onChange={async (t) => { await updateWish(w.id, { tier: t }); setMoving(false); showToast(`Moved to ${tierLabel(t)}`, () => void undoLast()); }} options={TIERS} />
      </Sheet>
    </main>
  );
}

/** "Bought": the day and what it cost; the piece lands in the wardrobe needing details. */
export function BuySheet({ open, onClose, wish }: { open: boolean; onClose: () => void; wish: Wish }) {
  const today = dayKey(Date.now());
  const [day, setDay] = useState(today);
  const [price, setPrice] = useState('');
  const parsed = price.trim() ? parseRoughPrice(price) : null;
  const bad = !!price.trim() && !parsed;
  const [busy, setBusy] = useState(false);
  const buy = async () => {
    if (bad || busy) return;
    setBusy(true);
    let itemId: Id;
    try {
      itemId = await buyWish(wish.id, { boughtOn: day, ...(parsed ? { price: parsed } : {}) });
    } catch (e) {
      setBusy(false);
      showToast(e instanceof Error ? e.message : 'Could not add it');
      return;
    }
    onClose();
    showToast(`Added ${wish.name}. It needs details.`, () => void undoLast());
    go('/piece', { id: itemId }, { replace: true });
  };
  return (
    <Sheet open={open} onClose={onClose} label="Bought">
      <div style={{ display: 'grid', gap: 14 }}>
        <p className="name" style={{ fontSize: 22 }}>Bought {wish.name}</p>
        <div className="q">
          <p className="ql">When?</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="field" style={{ display: 'flex', alignItems: 'center' }}>{day === today ? 'Today' : shortDay(day)}</span>
            <DayPicker value={day} onPick={setDay} />
          </div>
        </div>
        <div className="q">
          <label className="ql" htmlFor="buy-price">What it cost{wish.price ? `, if not ${roughPriceText(wish.price, wish.currency)}` : ''}</label>
          <input id="buy-price" className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={wish.price ? roughPriceText(wish.price, wish.currency) : 'About ₹800'} aria-invalid={bad} />
          {bad && <p className="warn-text">Try an amount, like "₹1,999".</p>}
        </div>
        <button type="button" className="acc" disabled={busy} onClick={() => void buy()}>Add to my things</button>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

/** "Glad you bought it?", 30 days after a wish was bought: the piece in a window and a 1 to 7 scale (Home shows it). */
export function GladCard({ wish, photo, cut, colour, today }: { wish: Wish; photo?: string; cut?: boolean; colour?: string; today: string }) {
  const days = wish.boughtOn ? daysBetween(wish.boughtOn, today) : 30;
  const answer = async (v: number | 'skip') => {
    await answerGlad(wish.id, v);
    showToast(v === 'skip' ? 'Skipped' : `Saved: ${v} of 7`, () => void undoLast());
  };
  return (
    <section className="card glad" aria-label="Glad you bought it?">
      <div className="glad-head">
        <Window className="glad-win" colour={colour} lit>
          <Piece src={photo} cut={cut} />
        </Window>
        <div>
          <p className="m sm">Bought {days} days ago</p>
          <p className="name glad-name">{wish.name}</p>
          <p>Glad you bought it?</p>
        </div>
      </div>
      <div className="glad-scale" role="group" aria-label="From 1, not at all, to 7, very">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" aria-label={n === 1 ? '1, not at all' : n === 7 ? '7, very' : String(n)} onClick={() => void answer(n)}>{n}</button>
        ))}
      </div>
      <div className="glad-ends m sm" aria-hidden="true"><span>not at all</span><span>very</span></div>
      <button type="button" className="link" onClick={() => void answer('skip')}>Skip</button>
    </section>
  );
}
