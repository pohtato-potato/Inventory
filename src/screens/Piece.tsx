import { useRef, useState } from 'react';
import { bringBack, copyItem, moveItems, savePhotos, trash, undoLast, updateItem, updatePhoto, wornToday, NO_SPACE } from '../db/actions';
import { useEvents, useItem, usePhotos, useTrees, useWearLog, type Trees } from '../db/hooks';
import { dayText, money, monthText, roughDateText, roughPriceText } from '../domain/format';
import type { Condition, Fit, Item, ItemEvent, Photo } from '../domain/types';
import { costPerWear, totalWears, wearsText } from '../domain/wears';
import { back, go, useRoute } from '../router';
import { bitmapFromFile } from '../photo/camera';
import { shrinkToWebp } from '../photo/cutout';
import { askConfirm, askText } from '../ui/Ask';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { Piece as Cut, Window } from '../ui/Window';
import { IconPin } from '../ui/icons';
import { kindName, pieceColour, placeLabel, SubTop, UncutNote } from './shared';

export const FIT_LABEL: Record<Fit, string> = { fits: 'Fits', tight: 'Tight', loose: 'Loose' };
export const FIT_TONE: Record<Fit, 'ok' | 'warn' | 'lo'> = { fits: 'ok', tight: 'warn', loose: 'lo' };
export const CONDITION_LABEL: Record<Condition, string> = { new: 'New', good: 'Good condition', worn: 'Worn', replace: 'Needs replacing' };

export function Piece() {
  const id = useRoute().params.get('id');
  const item = useItem(id);
  const trees = useTrees();
  const photos = usePhotos(id);
  const events = useEvents(id);
  const wear = useWearLog();
  if (item === null) return <Missing />;
  if (!item || !trees || !photos || !events || !wear) return <main className="screen" aria-busy="true" />;
  if (item.deletedAt) return <Missing trashed />;
  return item.status === 'gone'
    ? <GonePiece item={item} trees={trees} photos={photos} events={events} />
    : <OwnedPiece item={item} trees={trees} photos={photos} logged={wear.count.get(item.id) ?? 0} lastWorn={wear.last.get(item.id)} />;
}

function Missing({ trashed = false }: { trashed?: boolean }) {
  return (
    <main className="screen">
      <SubTop title="Piece" />
      <Window className="empty-win" colour="#4A4C55">
        <p className="name" style={{ fontSize: 22 }}>{trashed ? 'This piece is in the trash' : 'This piece is not here any more'}</p>
        {trashed && <p className="m">Restore it from Settings, under Trash.</p>}
        <button type="button" className="ghost" onClick={() => go('/wardrobe', undefined, { replace: true })}>Back to the wardrobe</button>
      </Window>
    </main>
  );
}

/** The piece's photos, paged sideways, with close-up spots on each. */
function Photos({ item, photos, colour, lit, marking, onMark }: { item: Item; photos: { url: string; photo: Photo }[]; colour: string; lit: boolean; marking: boolean; onMark: (p: Photo, x: number, y: number) => void }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  return (
    <Window colour={colour} lit={lit} className="piece-win">
      <div ref={strip} className="pager" onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {photos.length ? photos.map(({ url, photo }) => (
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
        )) : <figure className="page"><Cut /></figure>}
      </div>
      {photos.length > 1 && <span className="sm pager-n" aria-live="polite">{page + 1} of {photos.length}</span>}
      {marking && <span className="sm pager-hint">Tap the photo where the close-up is</span>}
      {!marking && item.cutout === 'pending' && <span className="sm pager-hint">Cutting out…</span>}
    </Window>
  );
}

function OwnedPiece({ item, trees, photos, logged, lastWorn }: { item: Item; trees: Trees; photos: { url: string; photo: Photo }[]; logged: number; lastWorn?: number }) {
  const [moving, setMoving] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [marking, setMarking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const colour = pieceColour(item, trees.shades);
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

  return (
    <main className="screen piece">
      <div style={{ position: 'relative' }}>
        <Photos item={item} photos={photos} colour={colour} lit marking={marking} onMark={mark} />
        <div className="piece-top">
          <SubTop title={kind} right={<button type="button" className="link" onClick={() => go('/details', { id: item.id, edit: '1' })}>Edit</button>} />
        </div>
      </div>
      <UncutNote item={item} />
      <div style={{ padding: '14px 18px 0' }}>
        <h2 className="name" style={{ fontSize: 31 }}>{item.name}{item.count > 1 ? ` ×${item.count}` : ''}</h2>
        <p className="m" style={{ paddingTop: 4 }}>{[shade?.name, item.brand, item.size, ...Object.values(item.extra).filter(Boolean)].filter(Boolean).join(' · ') || 'Add its details with Edit'}</p>
        <div className="chips" style={{ paddingTop: 10 }}>
          <button type="button" className={`chip${item.fit ? ` tone-${FIT_TONE[item.fit]}` : ''}`} onClick={() => setFitting(true)}>{item.fit ? FIT_LABEL[item.fit] : 'How does it fit?'}</button>
          {item.condition && <span className="chip" role="note">{CONDITION_LABEL[item.condition]}</span>}
          {item.tags.map((t) => <button key={t} type="button" className="chip" onClick={() => go('/search', { tag: t })}>#{t}</button>)}
        </div>
        {item.fitNote && <p className="m" style={{ paddingTop: 8 }}>{item.fitNote}</p>}
      </div>
      <div className="li" style={{ marginTop: 14 }}>
        <span className="m"><IconPin /></span>
        <span style={{ minWidth: 0 }}>
          {placeLabel(item.spotId, trees.places)}
          {usual.length > 0 && <span className="m sm" style={{ display: 'block' }}>Usually {usual.join(', ')}</span>}
        </span>
        <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => setMoving(true)}>Move</button>
      </div>
      <div className="li" style={{ alignItems: 'flex-end', paddingBlock: 12 }}>
        <Numeral value={wears.n} className="wears-num" />
        <span className="m" style={{ paddingBottom: 2 }}>{wearsText(wears)}<br />{lastWorn ? `last worn ${dayText(lastWorn)}` : 'no wears logged yet'}</span>
      </div>
      {money_ && <div className="li sm m" style={{ display: 'block' }}>{money_}{item.shop ? ` · ${item.shop}` : ''}</div>}
      <div style={{ display: 'flex', gap: 8, padding: '8px 18px 0' }}>
        <button type="button" className="acc" style={{ flex: 1 }} onClick={async () => { if (await wornToday(item.id)) showToast(`Worn today · ${wears.n + 1} wears`, () => void undoLast()); else showToast('Already logged for today'); }}>Worn today</button>
        <button type="button" className="ghost" onClick={async () => { const c = await copyItem(item.id); go('/details', { id: c, edit: '1' }); showToast(`Copied ${item.name}`); }}>Copy</button>
      </div>
      <div className="piece-more">
        <button type="button" className="ghost" onClick={() => file.current?.click()}>Add a photo</button>
        <button type="button" className="ghost" onClick={() => setMarking(!marking)} aria-pressed={marking}>{marking ? 'Stop marking' : 'Mark a close-up'}</button>
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
          <p className="name" style={{ fontSize: 22 }}>How does it fit now?</p>
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
        <p className="name" style={{ fontSize: 22 }}>Move {count === 1 ? 'it' : `${count} pieces`} to</p>
        {homes.map((h) => {
          const spots = trees.places.filter((p) => p.homeId === h.id);
          return spots.length ? (
            <div key={h.id} className="q">
              <p className="ql">{h.name}</p>
              <Chips label={h.name} value={current} onChange={(v) => onMove(v)} options={spots.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
          ) : null;
        })}
        <Chips label="Other" value={current ?? 'none'} onChange={(v) => onMove(v === 'none' ? undefined : v)} options={[...(withMe ? [{ value: withMe.id, label: 'With me' }] : []), { value: 'none', label: 'No spot' }]} />
        {!trees.places.some((p) => p.role === 'spot') && <p className="m">No spots yet. Add them in the wardrobe, By place.</p>}
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

// ---------- gone ----------

function storyLines(item: Item, events: ItemEvent[], trees: Trees): { when: string; what: string }[] {
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
  if (item.boughtOn) out.push({ at: -1, when: roughDateText({ ...item.boughtOn, estimate: false }), what: `Bought${item.price ? `, ${roughPriceText(item.price, item.currency)}` : ''}${item.shop ? ` at ${item.shop}` : ''}` });
  return out.sort((a, b) => b.at - a.at);
}

function GonePiece({ item, trees, photos, events }: { item: Item; trees: Trees; photos: { url: string; photo: Photo }[]; events: ItemEvent[] }) {
  const shade = trees.shades.find((s) => s.id === item.shadeMain);
  const lines = storyLines(item, events, trees);
  return (
    <main className="screen piece gone">
      <div style={{ position: 'relative' }}>
        <Photos item={item} photos={photos.slice(0, 1)} colour={pieceColour(item, trees.shades)} lit={false} marking={false} onMark={() => {}} />
        <div className="piece-top"><SubTop title={kindName(item.kindId, trees.kinds)} /></div>
        <span className="stamp gone-stamp">Gone</span>
      </div>
      <div style={{ padding: '14px 18px 0' }}>
        <h2 className="name" style={{ fontSize: 31 }}>{item.name}</h2>
        <p className="m" style={{ paddingTop: 4 }}>{[shade?.name, item.brand, item.size].filter(Boolean).join(' · ')}</p>
      </div>
      <h3 className="caps m" style={{ padding: '20px 18px 6px' }}>Its story</h3>
      {lines.map((l, i) => (
        <div key={i} className="li"><span className="m sm" style={{ width: 104, flex: 'none' }}>{l.when}</span><span>{l.what}</span></div>
      ))}
      <div style={{ padding: '16px 18px 0' }}>
        <button type="button" className="ghost wide" onClick={async () => { await bringBack(item.id); showToast(`${item.name} is back`, () => void undoLast()); }}>Bring it back</button>
      </div>
    </main>
  );
}
