import { useRef, useState, type CSSProperties } from 'react';
import { bringBack, copyItem, moveItems, savePhotos, trash, undoLast, updateItem, updatePhoto, wornToday, NO_SPACE } from '../db/actions';
import { useEvents, useItem, usePhotos, useTrees, useWearLog, useWishFor, type Trees } from '../db/hooks';
import type { Wish } from '../domain/types';
import { dayText, money, monthText, roughDateText, roughPriceText, shortDate } from '../domain/format';
import type { Condition, Fit, Item, ItemEvent, Photo } from '../domain/types';
import { costPerWear, lastWornText, totalWears, wearsText } from '../domain/wears';
import { back, go, useRoute } from '../router';
import { bitmapFromFile } from '../photo/camera';
import { dayKey, dayStart, shiftDay } from '../domain/wearlog';
import { shrinkToWebp } from '../photo/cutout';
import { askConfirm, askText } from '../ui/Ask';
import { Chips } from '../ui/Chips';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { Cut, pageColours } from '../ui/Swatch';
import { NoPhoto } from '../ui/kindIcons';
import { Tick } from '../ui/Tick';
import { floodBack, flooding } from '../ui/flood';
import { IconCalendar, IconCheck, IconRupee, IconPin } from '../ui/icons';
import { deltaE, hexToLab } from '../domain/colour';
import { kindGroup } from '../domain/kinds';
import { kindName, pieceColour, placeLabel, SubTop, UncutNote } from './shared';

/** Each child of a thing's page rises in, one after another, once the flood has filled the screen. */
const rise = (i: number, base: string): CSSProperties => ({ '--r0': base, '--d': `${i * 60}ms` } as CSSProperties);

export const FIT_LABEL: Record<Fit, string> = { fits: 'Fits', tight: 'Tight', loose: 'Loose' };
export const FIT_TONE: Record<Fit, 'ok' | 'warn' | 'lo'> = { fits: 'ok', tight: 'warn', loose: 'lo' };
export const CONDITION_LABEL: Record<Condition, string> = { new: 'New', good: 'Good condition', worn: 'Worn', replace: 'Needs replacing' };

export function Piece() {
  const id = useRoute().params.get('id');
  const item = useItem(id);
  const trees = useTrees();
  const photos = usePhotos(id);
  const events = useEvents(id);
  const wish = useWishFor(id);
  const wear = useWearLog();
  if (item === null) return <Missing />;
  if (!item || !trees || !photos || !events || !wear) return <main className="screen" aria-busy="true" />;
  if (item.deletedAt) return <Missing trashed />;
  return item.status === 'gone'
    ? <GonePiece item={item} trees={trees} photos={photos} events={events} wish={wish ?? undefined} />
    : <OwnedPiece item={item} trees={trees} photos={photos} logged={wear.count.get(item.id) ?? 0} lastWorn={wear.last.get(item.id)} wish={wish} />;
}

function Missing({ trashed = false }: { trashed?: boolean }) {
  return (
    <main className="screen">
      <SubTop title="Piece" />
      <div className="wellcard">
        <p className="name" style={{ fontSize: 22 }}>{trashed ? 'This piece is in the trash' : 'This piece is not here any more'}</p>
        {trashed && <p className="m">Restore it from Settings, under Trash.</p>}
        <button type="button" className="ghost" onClick={() => go('/everything', undefined, { replace: true })}>Back to Everything</button>
      </div>
    </main>
  );
}

/** The thing's photos, paged sideways, with close-up spots on each. With none, a big kind icon over its pattern. */
function Photos({ item, photos, group, marking, onMark, style }: { item: Item; photos: { url: string; photo: Photo }[]; group: ReturnType<typeof kindGroup>; marking: boolean; onMark: (p: Photo, x: number, y: number) => void; style?: CSSProperties }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  if (!photos.length) return <div className="piece-photos none rise" style={style}><NoPhoto group={group} size={84} /></div>;
  return (
    <div className="piece-photos rise" style={style}>
      <div ref={strip} className="pager" onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {photos.map(({ url, photo }) => (
          <figure key={photo.id} className="page">
            <div className="page-inner" onClick={(e) => {
              if (!marking) return;
              const img = e.currentTarget.querySelector('img')!.getBoundingClientRect();
              const x = (e.clientX - img.left) / img.width, y = (e.clientY - img.top) / img.height;
              if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onMark(photo, x, y);
            }}>
              <Cut src={url} cut={photo.role === 'main'} alt={`${item.name}${photo.role === 'extra' ? ', another photo' : ''}`} />
              {(photo.closeups ?? []).map((c, i) => (
                <button key={i} type="button" className="spot-dot" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} aria-label={`Close-up: ${c.label}`} onClick={(e) => { e.stopPropagation(); setOpen(open === `${photo.id}${i}` ? null : `${photo.id}${i}`); }}>
                  {open === `${photo.id}${i}` && <span className="spot-label">{c.label}</span>}
                </button>
              ))}
            </div>
          </figure>
        ))}
      </div>
      {photos.length > 1 && <span className="sm pager-n" aria-live="polite">{page + 1} of {photos.length}</span>}
      {marking && <span className="sm pager-hint">Tap the photo where the close-up is</span>}
      {!marking && item.cutout === 'pending' && <span className="sm pager-hint">Cutting out…</span>}
    </div>
  );
}

/** Three facts at a glance: when it was bought, what it cost, how many. */
function Facts({ item, cpw, style }: { item: Item; cpw?: string; style?: CSSProperties }) {
  const tiles = [
    { icon: <IconCalendar size={16} />, label: 'Bought', value: shortDate(item.boughtOn) || '–', note: item.boughtOn ? (item.boughtOn.estimate ? 'a guess is fine' : roughDateText(item.boughtOn)) : 'not set yet' },
    { icon: <IconRupee size={16} />, label: 'Paid', value: item.price ? money(item.price.value, item.currency) : '–', note: item.price ? (cpw ?? (item.price.estimate ? 'about' : item.shop ?? 'paid')) : 'not set yet' },
    { icon: <IconCheck size={16} />, label: 'Owned', value: `×${item.count}`, note: item.count === 1 ? 'just the one' : `${item.count} of them` },
  ];
  return (
    <div className="facts rise" style={style}>
      {tiles.map((t) => (
        <div key={t.label} className="fact well">
          <span className="fact-label">{t.icon}{t.label}</span>
          <span className={`num fact-value${t.value.length > 6 ? ' longer' : t.value.length > 5 ? ' long' : ''}`}>{t.value}</span>
          <span className="fact-note tint">{t.note}</span>
        </div>
      ))}
    </div>
  );
}

/** "Its colour. Tap to change.": for a thing with no photo, one shade from each colour family. */
function ColourPick({ item, trees, style }: { item: Item; trees: Trees; style?: CSSProperties }) {
  const families = trees.shades.filter((s) => !s.familyId);
  const pick = families.map((f) => {
    const own = trees.shades.filter((s) => s.familyId === f.id);
    return own.sort((a, b) => deltaE(hexToLab(a.hex), hexToLab(f.hex)) - deltaE(hexToLab(b.hex), hexToLab(f.hex)))[0] ?? f;
  });
  const famOf = trees.shades.find((s) => s.id === item.shadeMain)?.familyId ?? item.shadeMain;
  return (
    <div className="colour-pick rise" style={style}>
      <p className="sm tint">Its colour. Tap to change.</p>
      <div className="swatches" role="group" aria-label="Its colour">
        {pick.map((s) => {
          const on = famOf === s.familyId || item.shadeMain === s.id;
          return <button key={s.id} type="button" className={`swatch${on ? ' on' : ''}`} style={{ background: s.hex }} aria-label={s.name} aria-pressed={on} onClick={() => void updateItem(item.id, { shadeMain: s.id })} />;
        })}
      </div>
    </div>
  );
}

function OwnedPiece({ item, trees, photos, logged, lastWorn, wish }: { item: Item; trees: Trees; photos: { url: string; photo: Photo }[]; logged: number; lastWorn?: number; wish?: Wish | null }) {
  const [moving, setMoving] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [marking, setMarking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const colour = pieceColour(item, trees);
  const shade = trees.shades.find((s) => s.id === item.shadeMain);
  const wears = totalWears(item, logged);
  const cpw = costPerWear(item.price, wears, item.currency);
  const kind = kindName(item.kindId, trees.kinds);
  const usual = item.usualSpotIds.filter((s) => s !== item.spotId).map((s) => placeLabel(s, trees.places));
  const money_ = [item.boughtOn && `Bought ${roughDateText(item.boughtOn)}`, item.price && roughPriceText(item.price, item.currency), cpw?.text].filter(Boolean).join(' · ');

  const mark = async (p: Photo, x: number, y: number) => {
    setMarking(false);
    const label = await askText('What is this close-up?', 'For example: the stain on the cuff');
    if (label) await updatePhoto(p.id, { closeups: [...(p.closeups ?? []), { x, y, label }] });
  };
  const addPhoto = async (f: File) => {
    try {
      const bmp = await bitmapFromFile(f);
      const shot = await shrinkToWebp(bmp);
      bmp.close();
      await savePhotos(item.id, [{ role: 'extra', ...shot }]);
      showToast('Photo added');
    } catch (e) {
      showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't add that photo");
    }
  };

  const [base] = useState(() => (flooding() ? '420ms' : '0ms'));
  const group = kindGroup(item.kindId, trees.kinds);
  const clothing = group === 'clothes';
  const details = [item.brand, item.size, ...Object.entries(item.extra).filter(([k, v]) => v && k !== 'serial').map(([, v]) => v)].filter(Boolean).join(' · ');
  const worn = async () => { if (await wornToday(item.id)) showToast(`Worn today · ${wears.n + 1} wears`, () => void undoLast()); else showToast('Already logged for today'); };
  let i = 0;

  return (
    <main className="screen piece on-colour" style={pageColours(colour)}>
      <SubTop title="" onBack={() => floodBack(() => back())} right={<button type="button" className="link" onClick={() => go('/details', { id: item.id, edit: '1' })}>Edit</button>} />
      <Photos item={item} photos={photos} group={group} marking={marking} onMark={mark} style={rise(i++, base)} />
      <UncutNote item={item} />
      <div className="piece-head">
        <h2 className="name piece-name rise" style={rise(i++, base)}>{item.name}{item.count > 1 ? ` ×${item.count}` : ''}</h2>
        <p className="tint rise" style={rise(i++, base)}>{[kind, shade?.name].filter(Boolean).join(' · ')}</p>
        <button type="button" className="piece-where rise" style={rise(i++, base)} onClick={() => setMoving(true)} aria-label={`Lives in ${placeLabel(item.spotId, trees.places)}. Move`}>
          <IconPin size={20} />
          <span><span className="name">{placeLabel(item.spotId, trees.places)}</span>{usual.length > 0 && <span className="tint sm" style={{ display: 'block' }}>Usually {usual.join(', ')}</span>}</span>
        </button>
      </div>
      {!photos.length && <ColourPick item={item} trees={trees} style={rise(i++, base)} />}
      <Facts item={item} cpw={cpw?.text} style={rise(i++, base)} />
      {clothing && (
        <div className="wear-row well rise" style={rise(i++, base)}>
          <span className="num wears-num"><Tick value={wears.n} /></span>
          <span className="tint sm">{wearsText(wears)}<br />{lastWorn ? `last worn ${lastWornText(dayKey(lastWorn), dayKey(Date.now()))}` : 'never logged'}</span>
        </div>
      )}
      <div className="piece-rows rise" style={rise(i++, base)}>
        {item.extra.serial && <div className="row well"><span className="tint sm">Serial</span><b>{item.extra.serial}</b></div>}
        {details && <div className="row well"><span className="tint sm">Details</span><span>{details}</span></div>}
        {money_ && <div className="row well"><span className="tint sm">Cost</span><span>{money_}{item.shop ? ` · ${item.shop}` : ''}</span></div>}
        {gladText(wish) && <div className="row well"><span>{gladText(wish)}</span></div>}
        <div className="chips">
          <button type="button" className={`chip${item.fit ? ` tone-${FIT_TONE[item.fit]} on` : ''}`} onClick={() => setFitting(true)}>{item.fit ? FIT_LABEL[item.fit] : 'How does it fit?'}</button>
          {item.condition && <span className="chip" role="note">{CONDITION_LABEL[item.condition]}</span>}
          {item.tags.map((t) => <button key={t} type="button" className="chip" onClick={() => go('/search', { tag: t })}>#{t}</button>)}
        </div>
        {item.fitNote && <p className="tint">{item.fitNote}</p>}
      </div>
      <div className="pair piece-main rise" style={rise(i++, base)}>
        {clothing ? (
          <>
            <button type="button" className="acc" onClick={() => void worn()}>Worn today</button>
            <button type="button" className="ghost" onClick={() => setMoving(true)}>Move</button>
          </>
        ) : (
          <>
            <button type="button" className="acc" onClick={() => setMoving(true)}>Move</button>
            <button type="button" className="ghost" onClick={() => file.current?.click()}>Add a photo</button>
          </>
        )}
      </div>
      <div className="pair piece-more rise" style={rise(i++, base)}>
        {clothing && <button type="button" className="ghost" onClick={() => file.current?.click()}>Add a photo</button>}
        <button type="button" className="ghost" onClick={async () => { const c = await copyItem(item.id); go('/details', { id: c, edit: '1' }); showToast(`Copied ${item.name}`); }}>Copy</button>
        <button type="button" className="ghost" onClick={() => setMarking(!marking)} aria-pressed={marking}>{marking ? 'Stop marking' : 'Mark a close-up'}</button>
        {!clothing && <button type="button" className="ghost" onClick={() => void worn()}>Worn today</button>}
        <button type="button" className="ghost" onClick={async () => {
          if (!(await askConfirm(`Delete ${item.name}? It stays in the trash for 30 days.`, 'Delete'))) return;
          await trash([item.id]);
          back();
          showToast(`Deleted ${item.name}`, () => void undoLast());
        }}>Delete</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addPhoto(f); e.target.value = ''; }} />
      </div>
      <MoveSheet open={moving} onClose={() => setMoving(false)} trees={trees} current={item.spotId} count={1} onMove={async (spot) => { await moveItems([item.id], spot); setMoving(false); showToast(`Moved to ${placeLabel(spot, trees.places)}`, () => void undoLast()); }} />
      <Sheet open={fitting} onClose={() => setFitting(false)} label="How does it fit now?">
        <div className="q">
          <p className="name">How does it fit now?</p>
          <Chips label="Fit" value={item.fit} onChange={async (v) => { await updateItem(item.id, { fit: item.fit === v ? undefined : v }); setFitting(false); }}
            options={(['tight', 'fits', 'loose'] as Fit[]).map((f) => ({ value: f, label: FIT_LABEL[f], tone: FIT_TONE[f] }))} />
          <button type="button" className="ghost" style={{ marginTop: 8 }} onClick={() => setFitting(false)}>Done</button>
        </div>
      </Sheet>
    </main>
  );
}

/** Pick a spot to move pieces to: spots by home, With me, or No spot. */
export function MoveSheet({ open, onClose, trees, current, count, onMove }: { open: boolean; onClose: () => void; trees: Trees; current?: string; count: number; onMove: (spot: string | undefined) => void }) {
  const homes = trees.places.filter((p) => p.role === 'home');
  const withMe = trees.places.find((p) => p.role === 'withme');
  return (
    <Sheet open={open} onClose={onClose} label="Move">
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="name">Move {count === 1 ? 'it' : `${count} pieces`} to</p>
        {homes.map((h) => {
          const spots = trees.places.filter((p) => p.homeId === h.id);
          return spots.length ? (
            <div key={h.id} className="q">
              <p className="ql">{h.name}</p>
              <Chips label={h.name} value={current} onChange={(v) => onMove(v)} options={spots.map((s) => ({ value: s.id, label: <><IconPin size={16} />{s.name}</> }))} />
            </div>
          ) : null;
        })}
        <Chips label="Other" value={current ?? 'none'} onChange={(v) => onMove(v === 'none' ? undefined : v)} options={[...(withMe ? [{ value: withMe.id, label: 'With me' }] : []), { value: 'none', label: 'No spot' }]} />
        {!trees.places.some((p) => p.role === 'spot') && <p className="m">No spots yet. Add them in Places.</p>}
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

// ---------- gone ----------

/** The answer to "Glad you bought it?", for the piece's page and its story. */
export const gladText = (w: Wish | null | undefined) => (w?.glad ? `Glad you bought it: ${w.glad} of 7` : '');

function storyLines(item: Item, events: ItemEvent[], trees: Trees, wish?: Wish): { when: string; what: string }[] {
  const out: { when: string; what: string; at: number }[] = [];
  const worn = events.filter((e) => e.type === 'worn');
  for (const e of events) {
    if (e.type === 'gone') {
      const g = e.data as Item['gone'] | undefined;
      const amount = g?.amount ? ` for ${money(g.amount, item.currency)}` : '';
      const to = g?.to ? ` to ${g.to}` : '';
      const what = g?.how === 'sold' ? `Sold${to}${amount}` : g?.how === 'donated' ? `Donated${to}` : g?.how === 'given' ? `Given away${to}` : g?.how === 'thrown' ? 'Thrown away' : 'Let go';
      out.push({ at: e.at, when: dayText(e.at, 0), what });
    } else if (e.type === 'back') out.push({ at: e.at, when: dayText(e.at, 0), what: 'Brought back' });
    else if (e.type === 'moved' && e.data?.to) out.push({ at: e.at, when: dayText(e.at, 0), what: `Moved to ${placeLabel(e.data.to as string, trees.places)}` });
    else if (e.type === 'edited' && typeof e.data?.fit === 'string') out.push({ at: e.at, when: monthText(e.at), what: `Marked ${(e.data.fit as string)}` });
    else if (e.type === 'added') out.push({ at: e.at, when: dayText(e.at, 0), what: e.data?.copyOf ? 'Added as a copy' : 'Added to Inventory' });
  }
  const w = totalWears(item, worn.length);
  if (w.n > 0) {
    const first = item.boughtOn ? roughDateText(item.boughtOn).replace(/^about /, '') : worn[0] ? monthText(worn[0].at) : '';
    const last = worn.length ? new Date(worn.at(-1)!.at).getFullYear() : item.gone?.on.slice(0, 4);
    out.push({ at: worn[0]?.at ?? item.createdAt - 1, when: first && last && !first.endsWith(String(last)) ? `${first} to ${last}` : first || '', what: `Worn ${w.approx ? 'about ' : w.atLeast ? 'at least ' : ''}${w.n} time${w.n === 1 ? '' : 's'}` });
  }
  if (wish?.glad && wish.boughtOn) out.push({ at: 0, when: dayText(dayStart(shiftDay(wish.boughtOn, 30)), 0), what: gladText(wish) });
  if (item.boughtOn) out.push({ at: -1, when: roughDateText({ ...item.boughtOn, estimate: false }), what: `Bought${item.price ? `, ${roughPriceText(item.price, item.currency)}` : ''}${item.shop ? ` at ${item.shop}` : ''}` });
  return out.sort((a, b) => b.at - a.at);
}

function GonePiece({ item, trees, photos, events, wish }: { item: Item; trees: Trees; photos: { url: string; photo: Photo }[]; events: ItemEvent[]; wish?: Wish }) {
  const shade = trees.shades.find((s) => s.id === item.shadeMain);
  const lines = storyLines(item, events, trees, wish);
  return (
    <main className="screen piece gone">
      <SubTop title="" onBack={() => floodBack(() => back())} />
      <div className="gone-photo">
        {photos[0] ? <Cut src={photos[0].url} cut={photos[0].photo.role === 'main'} alt={item.name} /> : <NoPhoto group={kindGroup(item.kindId, trees.kinds)} size={72} />}
        <span className="stamp gone-stamp lands">Gone</span>
      </div>
      <div className="piece-head">
        <h2 className="name piece-name">{item.name}</h2>
        <p className="m">{[kindName(item.kindId, trees.kinds), shade?.name, item.brand, item.size].filter(Boolean).join(' · ')}</p>
      </div>
      <h3 className="caps m section-cap">Its story</h3>
      {lines.map((l, i) => (
        <div key={i} className="li rise" style={{ '--d': `${i * 50}ms` } as CSSProperties}><span className="m sm" style={{ width: 104, flex: 'none' }}>{l.when}</span><span>{l.what}</span></div>
      ))}
      <div style={{ padding: '16px 14px 0' }}>
        <button type="button" className="ghost wide" onClick={async () => { await bringBack(item.id); showToast(`${item.name} is back`, () => void undoLast()); }}>Bring it back</button>
      </div>
    </main>
  );
}
