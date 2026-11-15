import { useRef, useState } from 'react';
import { logWear, NO_SPACE, removePhoto, removeWear, savePhotos, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfits, usePhotosOf, useTrees, useWears } from '../db/hooks';
import { isUnsorted } from '../domain/fields';
import { regulars, samePieces } from '../domain/outfit';
import type { Id } from '../domain/types';
import { dayKey, dayStart, shiftDay, suggestWear } from '../domain/wearlog';
import { wearLine } from '../domain/wears';
import { bitmapFromFile } from '../photo/camera';
import { shrinkToWebp } from '../photo/cutout';
import { go, useRoute } from '../router';
import { Numeral } from '../ui/Numeral';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { IconBack, IconChev } from '../ui/icons';
import { OutfitStage, piecesText } from './Outfits';
import { DayPicker, pieceColour, SubTop } from './shared';

/** Adds a photo from the phone (camera or gallery) against an outfit or a wear, as a mirror photo. */
export function MirrorPhoto({ ownerId, label = 'Add a mirror photo' }: { ownerId: Id; label?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const photos = usePhotosOf(ownerId);
  const add = async (f: File) => {
    try {
      const bmp = await bitmapFromFile(f);
      const shot = await shrinkToWebp(bmp);
      bmp.close();
      await savePhotos(ownerId, [{ role: 'selfie', ...shot }]);
      showToast('Mirror photo added');
    } catch (e) {
      showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't add that photo");
    }
  };
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

/** What was worn on a day: the suggestion in one tap, or pick an outfit or pieces. No reminders, no streaks. */
export function WearLog() {
  const { params } = useRoute();
  const today = dayKey(Date.now());
  const asked = params.get('day');
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const trees = useTrees();
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const outfits = useOutfits();
  const wears = useWears();
  const [draft, setDraft] = useState<Id[] | null>(null);
  const [draftDay, setDraftDay] = useState(day);
  if (draftDay !== day) { setDraftDay(day); setDraft(null); }

  if (!trees || !all || !thumbs || !outfits || !wears) return <main className="screen" aria-busy="true" />;
  const w = wears.find((x) => x.day === day);
  const s = w ? null : suggestWear(outfits, wears.filter((x) => x.day < day), day);
  const clothing = new Set(trees.kinds.filter((k) => k.clothing).map((k) => k.id));
  const owned = all.filter((i) => i.status === 'owned' && i.deletedAt === undefined && clothing.has(i.kindId) && !isUnsorted(i.kindId));
  const editing = draft !== null || (!w && !s);
  const pieces = draft ?? w?.itemIds ?? [];
  const regs = regulars(outfits, wears);
  const goDay = (d: string) => go('/wear', d === today ? {} : { day: d }, { replace: true });
  const toggle = (id: Id) => setDraft(pieces.includes(id) ? pieces.filter((x) => x !== id) : [...pieces, id]);
  const save = async () => {
    if (!pieces.length) return;
    const o = outfits.find((x) => samePieces(x.itemIds, pieces));
    await logWear(day, pieces, o?.id);
    setDraft(null);
    showToast(day === today ? 'Logged for today' : `Logged for ${longDay(day)}`, () => void undoLast());
  };

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
        <section className="wear-card" aria-label="Logged">
          <OutfitStage ids={w.itemIds} items={all} trees={trees} thumbs={thumbs} height={220} label={`Logged: ${piecesText(w.itemIds, all)}`} />
          <div className="wear-side">
            <p className="caps m">Logged</p>
            <p>{wearLine(w, outfits, all)}</p>
            <button type="button" className="ghost" onClick={() => setDraft(w.itemIds)}>Change</button>
            <button type="button" className="ghost" onClick={async () => { await removeWear(day); showToast('Cleared the day', () => void undoLast()); }}>Clear this day</button>
          </div>
        </section>
      )}
      {w && draft === null && <div style={{ padding: '0 18px' }}><MirrorPhoto ownerId={w.id} /></div>}

      {s && draft === null && (
        <section className="wear-card" aria-label="Same as last time?">
          <OutfitStage ids={s.itemIds} items={all} trees={trees} thumbs={thumbs} height={220} label={piecesText(s.itemIds, all)} />
          <div className="wear-side">
            <p className="name" style={{ fontSize: 24 }}>Same as last time?</p>
            <p className="m">{wearLine({ id: '', day, itemIds: s.itemIds, outfitId: s.outfitId, updatedAt: 0 }, outfits, all)}</p>
            <button type="button" className="acc" onClick={async () => { await logWear(day, s.itemIds, s.outfitId); showToast(day === today ? 'Logged for today' : `Logged for ${longDay(day)}`, () => void undoLast()); }}>Yes, this</button>
          </div>
        </section>
      )}

      {owned.length > 0 && (!w || draft !== null) && (
        <>
          <h2 className="caps m section-cap">{w ? 'Change the day' : 'Something else'}</h2>
          {regs.length > 0 && (
            <div className="regulars">
              {regs.map((o, i) => (
                <button key={o.id} type="button" className="regular" aria-pressed={samePieces(o.itemIds, pieces)} onClick={() => setDraft(o.itemIds)}>
                  <OutfitStage ids={o.itemIds} items={all} trees={trees} thumbs={thumbs} height={170} label={o.name ?? piecesText(o.itemIds, all)} delay={i * 80} />
                  <span className="sm m">{o.name ?? piecesText(o.itemIds, all)}</span>
                </button>
              ))}
            </div>
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
          <h2 className="caps m section-cap">Pieces</h2>
          <div className="grid">
            {owned.filter((i) => !pieces.includes(i.id)).map((i, n) => {
              const t = thumbs.get(i.id);
              return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={n} onPress={() => toggle(i.id)} />;
            })}
          </div>
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
