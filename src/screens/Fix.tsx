import { useEffect, useRef, useState } from 'react';
import { undoLast } from '../db/actions';
import { useItem, usePhoto, useTrees } from '../db/hooks';
import { pageColours } from '../ui/Swatch';
import { back, useRoute } from '../router';
import { readPixels } from '../photo/cutout';
import { closeFix, fixModelCached, fixModelState, loadFixModel, prepareFix, saveFix, tapFix } from '../photo/fix';
import { addPoint, tapAt, undoPoint, type TapMode, type TapPoint } from '../photo/points';
import { samDownloadText } from '../photo/samPlan';
import { Seg } from '../ui/Seg';
import { showToast } from '../ui/Toast';
import { pieceColour, SubTop } from './shared';

type Phase =
  | { k: 'ask'; size: string } // the model is not downloaded yet: say how big it is first
  | { k: 'loading'; fraction: number; downloading: boolean }
  | { k: 'preparing' }
  | { k: 'ready' }
  | { k: 'failed'; message: string };

/**
 * Tap to fix a cut-out: the uncut photo at full size; taps add keep or remove points, the model finds the piece,
 * and the result previews as a tint. Done saves it as the piece's cut-out (one step for Undo).
 */
export function Fix() {
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const item = useItem(id);
  const trees = useTrees();
  const original = usePhoto(id, 'original');
  const [phase, setPhase] = useState<Phase | null>(null);
  const [mode, setMode] = useState<TapMode>('keep');
  const [points, setPoints] = useState<TapPoint[]>([]);
  const [mask, setMask] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const photo = useRef<{ pixels: Uint8ClampedArray; w: number; h: number } | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const tint = useRef<HTMLCanvasElement>(null);
  const asked = useRef(0); // the latest tap's number, so a slow answer never overwrites a newer one

  // Free the model's memory when leaving; it loads from the cache next time.
  useEffect(() => () => closeFix(), []);

  // Start: is the model here already? If not, say how big it is before downloading anything.
  useEffect(() => {
    if (!original) return;
    let live = true;
    void (async () => {
      if (fixModelState() !== 'ready' && !(await fixModelCached())) {
        if (live) setPhase({ k: 'ask', size: await samDownloadText() });
        return;
      }
      if (live) await start(false, () => live);
    })();
    return () => { live = false; };
  }, [original?.photo.id, tries]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start(downloading: boolean, live: () => boolean = () => true) {
    if (!original) return;
    try {
      setPhase({ k: 'loading', fraction: 0, downloading });
      await loadFixModel((f) => live() && setPhase({ k: 'loading', fraction: f, downloading }));
      if (!live()) return;
      setPhase({ k: 'preparing' });
      const p = original.photo;
      if (!photo.current) {
        const bitmap = await createImageBitmap(p.blob);
        try {
          photo.current = { pixels: await readPixels(bitmap, p.w, p.h), w: p.w, h: p.h };
        } finally {
          bitmap.close?.();
        }
      }
      await prepareFix(`${p.id}-${p.updatedAt}`, photo.current.pixels, p.w, p.h);
      if (!live()) return;
      setPhase({ k: 'ready' });
      if (points.length) void ask(points);
    } catch {
      if (!live()) return;
      setPhase({
        k: 'failed',
        message: navigator.onLine === false && downloading
          ? 'The fix tool needs the internet once, to download. Try again when you are online.'
          : 'The fix tool stopped. Try again.',
      });
    }
  }

  async function ask(next: TapPoint[]) {
    const n = ++asked.current;
    if (!next.length) {
      setMask(null);
      return;
    }
    setBusy(true);
    try {
      const r = await tapFix(next);
      if (n === asked.current) setMask(r.alpha);
    } catch {
      if (n === asked.current) setPhase({ k: 'failed', message: 'The fix tool stopped. Try again.' });
    } finally {
      if (n === asked.current) setBusy(false);
    }
  }

  const change = (next: TapPoint[]) => {
    setPoints(next);
    setNote(null);
    void ask(next);
  };

  // The tint: the piece the model found, in the app's blue; the rest of the photo dimmed.
  useEffect(() => {
    const c = tint.current;
    const ph = photo.current;
    if (!c || !ph) return;
    c.width = ph.w;
    c.height = ph.h;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, ph.w, ph.h);
    if (!mask) return;
    const im = ctx.createImageData(ph.w, ph.h);
    for (let i = 0; i < ph.w * ph.h; i++) {
      if (mask[i]) im.data.set([127, 167, 255, 110], i * 4);
      else im.data.set([11, 12, 15, 150], i * 4);
    }
    ctx.putImageData(im, 0, 0);
  }, [mask]);

  const done = async () => {
    const ph = photo.current;
    if (!ph || !mask || !item) return;
    setBusy(true);
    try {
      const r = await saveFix(item.id, { ...ph, alpha: mask, points });
      if (!r.ok) {
        setNote(r.message);
        return;
      }
      showToast('Cut-out fixed', () => void undoLast());
      back();
    } catch {
      setNote('Couldn’t save the cut-out. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  if (item === undefined || original === undefined) return <main className="screen" aria-busy="true" />;
  if (!item || !original) {
    return (
      <main className="screen">
        <SubTop title="Fix the cut-out" />
        <p style={{ padding: '14px 18px' }}>This piece has no photo as taken to fix from.</p>
      </main>
    );
  }

  const ready = phase?.k === 'ready';
  return (
    <main className={`screen fix${trees ? ' on-colour' : ''}`} style={trees ? pageColours(pieceColour(item, trees)) : undefined}>
      <SubTop title="Fix the cut-out" />
      <div className="fix-stage">
        <div className="fix-photo">
          <img
            ref={img}
            src={original.url}
            alt={`${item.name}, as taken`}
            onClick={(e) => {
              if (!ready) return;
              change(addPoint(points, tapAt(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), mode)));
            }}
          />
          <canvas ref={tint} className="fix-tint" aria-hidden="true" />
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`fix-pt ${p.label ? 'keep' : 'remove'}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              aria-label={`${p.label ? 'Keep' : 'Remove'} point ${i + 1}. Tap to take it away.`}
              onClick={() => change(points.filter((_, k) => k !== i))}
            >
              <span aria-hidden="true">{p.label ? '+' : '−'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fix-controls">
        {phase?.k === 'ask' && (
          <div className="fix-ask">
            <p>Fixing by tapping uses a second tool. This needs a one-time download of {phase.size}; after that it works offline.</p>
            <button type="button" className="acc" onClick={() => void start(true)}>Download it</button>
          </div>
        )}
        {phase?.k === 'loading' && (
          <p role="status">{phase.downloading ? `Downloading the fix tool… ${Math.round(phase.fraction * 100)} %` : 'Getting the fix tool ready…'}</p>
        )}
        {phase?.k === 'preparing' && <p role="status">Getting the photo ready…</p>}
        {phase?.k === 'failed' && (
          <div className="fix-ask">
            <p role="alert">{phase.message}</p>
            <button type="button" className="ghost" onClick={() => { setPhase(null); setTries((t) => t + 1); }}>Try again</button>
          </div>
        )}
        {ready && (
          <>
            <Seg label="What a tap does" value={mode} onChange={setMode} options={[{ value: 'keep', label: 'Keep this part' }, { value: 'remove', label: 'Remove this part' }]} />
            <p className="m fix-hint" role="status">
              {note ?? (busy ? 'Finding it…' : points.length ? (mode === 'keep' ? 'Tap any part it missed.' : 'Tap what to take away.') : mode === 'keep' ? 'Tap the piece.' : 'Tap what to take away.')}
            </p>
            <div className="fix-edits">
              <button type="button" className="ghost" disabled={!points.length} onClick={() => change(undoPoint(points))}>Undo point</button>
              <button type="button" className="ghost" disabled={!points.length} onClick={() => change([])}>Start again</button>
            </div>
          </>
        )}
      </div>

      <div className="bottom-bar fix-bar">
        <button type="button" className="ghost" onClick={() => back()}>Cancel</button>
        <button type="button" className="acc" disabled={!ready || !mask || busy} onClick={() => void done()}>Done</button>
      </div>
    </main>
  );
}
