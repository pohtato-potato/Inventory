import { useRef, useState } from 'react';
import { logWear, removePhoto, removeWear, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfits, usePhotosOf, useSelfies, useToday, useTrees, useWears } from '../db/hooks';
import { wearPhotos } from '../domain/face';
import { isUnsorted } from '../domain/fields';
import { samePieces, splitRegulars } from '../domain/outfit';
import type { Id, Item } from '../domain/types';
import { dayStart, shiftDay, suggestWear, suggestWords } from '../domain/wearlog';
import { wearLine } from '../domain/wears';
import { go, useRoute } from '../router';
import { Numeral } from '../ui/Numeral';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { IconBack, IconChev } from '../ui/icons';
import { addMirrorPhoto } from './OutfitPage';
import { faceOf, OutfitStage, piecesText } from './Outfits';
import { DayPicker, pieceColour, SubTop } from './shared';

/** Adds a photo from the phone (camera or gallery) against an outfit or a wear, as a mirror photo. */
export function MirrorPhoto({ ownerId, label = 'Add a mirror photo' }: { ownerId: Id; label?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const photos = usePhotosOf(ownerId);
  const add = (f: File) => addMirrorPhoto(ownerId, f);
  const selfies = (photos ?? []).filter((p) => p.photo.role === 'selfie');
  return (
    <div className="mirror">
      {selfies.length > 0 && (
        <div className="mirror-row">
          {selfies.map((p) => (
            <figure key={p.photo.id} className="mirror-shot">
              <img src={p.url} alt="Mirror photo" />
              <button type="button" className="link" onClick={async () => { await removePhoto(p.photo.id); showToast('Removed the photo', () => void undoLast()); }}>Remove</button>
            </figure>
          ))}
        </div>
      )}
      <button type="button" className="ghost" onClick={() => file.current?.click()}>{label}</button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ''; }} />
    </div>
  );
}

const longDay = (day: string) => new Date(dayStart(day)).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/** The suggestion without pieces let go or deleted since; the outfit only when none were dropped. */
function stillOwned(s: { outfitId?: Id; itemIds: Id[] } | null, items: Item[]) {
  if (!s) return null;
  const itemIds = s.itemIds.filter((id) => items.some((i) => i.id === id && i.status === 'owned' && i.deletedAt === undefined));
  if (!itemIds.length) return null;
  return itemIds.length === s.itemIds.length ? s : { itemIds };
}

/**
 * What was worn on a day. Most days it is one tap: the likely outfit stands in a window ("Same as last Monday?"). Then
 * your regulars, then pieces one by one. No reminders, no streaks.
 */
export function WearLog() {
  const { params } = useRoute();
  const today = useToday();
  const asked = params.get('day');
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const trees = useTrees();
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const outfits = useOutfits();
  const wears = useWears();
  const selfies = useSelfies();
  const file = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Id[] | null>(null);
  const [draftDay, setDraftDay] = useState(day);
  if (draftDay !== day) { setDraftDay(day); setDraft(null); }

  if (!trees || !all || !thumbs || !outfits || !wears || !selfies) return <main className="screen" aria-busy="true" />;
  const w = wears.find((x) => x.day === day);
  const before = wears.filter((x) => x.day < day);
  const s = w ? null : stillOwned(suggestWear(outfits, before, day), all);
  const clothing = new Set(trees.kinds.filter((k) => k.clothing).map((k) => k.id));
  const owned = all.filter((i) => i.status === 'owned' && i.deletedAt === undefined && clothing.has(i.kindId) && !isUnsorted(i.kindId));
  const editing = draft !== null || (!w && !s);
  const pieces = draft ?? w?.itemIds ?? [];
  const { worn, saved } = splitRegulars(outfits, wears);
  const regs = [...worn, ...saved];
  const goDay = (d: string) => go('/wear', d === today ? {} : { day: d }, { replace: true });
  const toggle = (id: Id) => setDraft(pieces.includes(id) ? pieces.filter((x) => x !== id) : [...pieces, id]);
  const logged = () => showToast(day === today ? 'Logged for today' : `Logged for ${longDay(day)}`, () => void undoLast());
  const save = async () => {
    if (!pieces.length) return;
    const o = outfits.find((x) => samePieces(x.itemIds, pieces));
    await logWear(day, pieces, o?.id);
    setDraft(null);
    logged();
  };
  const sOutfit = s?.outfitId ? outfits.find((o) => o.id === s.outfitId) : undefined;
  const wFace = w ? wearPhotos(w, selfies.map((x) => x.photo))[0] : undefined;
  const wFaceUrl = wFace ? selfies.find((x) => x.photo.id === wFace.id)?.url : faceOf(outfits.find((o) => o.id === w?.outfitId), wears, selfies);

  return (
    <main className="screen wearlog" style={editing ? { paddingBottom: 'calc(96px + var(--safe-b))' } : undefined}>
      <SubTop title="What you wore" />
      <div className="day-head">
        <button type="button" className="icon-btn" aria-label="The day before" onClick={() => goDay(shiftDay(day, -1))}><IconBack /></button>
        <div className="day-mid">
          <Numeral value={Number(day.slice(8))} roll={false} className="day-num" />
          <p><b>{day === today ? 'Today' : day === shiftDay(today, -1) ? 'Yesterday' : ''}</b>{day === today || day === shiftDay(today, -1) ? <br /> : null}<span className="m">{longDay(day)}</span></p>
        </div>
        <DayPicker value={day} onPick={goDay} />
        <button type="button" className="icon-btn" aria-label="The day after" disabled={day >= today} onClick={() => goDay(shiftDay(day, 1))}><IconChev size={20} /></button>
      </div>

      {owned.length === 0 && <p style={{ padding: '14px 18px' }}>Add a few pieces first; then log what you wore here.</p>}

      {w && draft === null && (
        <section className="wear-today" aria-label="Logged">
          <OutfitStage ids={w.itemIds} items={all} trees={trees} thumbs={thumbs} height={290} width="100%" face={wFaceUrl} label={`Logged: ${piecesText(w.itemIds, all)}`} />
          <p className="wear-q"><b>Logged</b> <span className="m">{wearLine(w, outfits, all)}</span></p>
          <div className="wear-acts">
            <button type="button" className="ghost" style={{ flex: 1 }} onClick={() => setDraft(w.itemIds)}>Change</button>
            <button type="button" className="ghost" style={{ flex: 1 }} onClick={async () => { await removeWear(day); showToast('Cleared the day', () => void undoLast()); }}>Clear this day</button>
          </div>
          <MirrorPhoto ownerId={w.id} />
        </section>
      )}

      {s && draft === null && (
        <section className="wear-today" aria-label="The likely outfit">
          <OutfitStage ids={s.itemIds} items={all} trees={trees} thumbs={thumbs} height={290} width="100%" face={faceOf(sOutfit, wears, selfies)} label={piecesText(s.itemIds, all)} />
          <p className="wear-q"><b>{suggestWords(s, outfits, before, day).question}</b> <span className="m">{piecesText(s.itemIds, all)}</span></p>
          <div className="wear-acts">
            <button type="button" className="acc" style={{ flex: 1 }} onClick={async () => { await logWear(day, s.itemIds, s.outfitId); logged(); }}>Yes, this</button>
            <button type="button" className="ghost" onClick={() => file.current?.click()}>Mirror photo</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              // Wearing it, with a photo: log the day, then keep the photo on it.
              const id = await logWear(day, s.itemIds, s.outfitId);
              logged();
              await addMirrorPhoto(id, f);
            }} />
          </div>
        </section>
      )}

      {owned.length > 0 && (!w || draft !== null) && (
        <>
          {regs.length > 0 && (
            <>
              <h2 className="caps m section-cap">{s || w ? 'Or one of your regulars' : 'One of your regulars'}</h2>
              <div className="regulars">
                {regs.map((o, i) => (
                  <button key={o.id} type="button" className="regular small" aria-pressed={samePieces(o.itemIds, pieces)} onClick={() => setDraft(o.itemIds)}>
                    <OutfitStage ids={o.itemIds} items={all} trees={trees} thumbs={thumbs} height={115} width={77} face={faceOf(o, wears, selfies)} label={o.name ?? piecesText(o.itemIds, all)} delay={i * 80} />
                    {o.name && <span className="sm m">{o.name}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {!editing && (
            <button type="button" className="link wear-pick" onClick={() => setDraft([])}>Pick pieces one by one</button>
          )}
          {editing && pieces.length > 0 && (
            <>
              <h2 className="caps m section-cap">On {day === today ? 'today' : 'this day'} · tap to take off</h2>
              <div className="grid">
                {pieces.map((id, n) => {
                  const i = all.find((x) => x.id === id);
                  if (!i) return null;
                  const t = thumbs.get(id);
                  return <Tile key={id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={n} selected onPress={() => toggle(id)} />;
                })}
              </div>
            </>
          )}
          {editing && (
            <>
              <h2 className="caps m section-cap">Pieces</h2>
              <div className="grid">
                {owned.filter((i) => !pieces.includes(i.id)).map((i, n) => {
                  const t = thumbs.get(i.id);
                  return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={n} onPress={() => toggle(i.id)} />;
                })}
              </div>
            </>
          )}
        </>
      )}

      {editing && owned.length > 0 && (
        <div className="bottom-bar">
          {draft !== null && <button type="button" className="ghost" onClick={() => setDraft(null)}>Cancel</button>}
          <button type="button" className="acc" style={{ flex: 1 }} disabled={!pieces.length || (!!w && samePieces(w.itemIds, pieces))} onClick={() => void save()}>
            {pieces.length ? `Log ${pieces.length === 1 ? 'this piece' : `these ${pieces.length}`}` : 'Tap what you wore'}
          </button>
        </div>
      )}
    </main>
  );
}
