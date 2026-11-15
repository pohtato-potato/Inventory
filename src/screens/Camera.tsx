import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useMainPhotos, useTrees } from '../db/hooks';
import { NO_SPACE } from '../db/actions';
import { back, go, useRoute } from '../router';
import { bitmapFromFile, openCamera } from '../photo/camera';
import { addShot, onCutoutLanded, retakeShot } from '../photo/conveyor';
import { loadModel, modelCached, modelState } from '../photo/cutout';
import { Numeral } from '../ui/Numeral';
import { showToast } from '../ui/Toast';
import { Piece, Window } from '../ui/Window';
import { pieceColour } from './shared';

/** Shoot piece after piece. Each shot becomes a piece at once; cut-outs follow one at a time. */
export function Camera() {
  const params = useRoute().params;
  const scope = params.get('scope') === 'things' ? 'things' : 'clothing';
  const retake = params.get('retake');
  const video = useRef<HTMLVideoElement>(null);
  const cam = useRef<Awaited<ReturnType<typeof openCamera>> | null>(null);
  const [noCamera, setNoCamera] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [flash, setFlash] = useState(0);
  const [model, setModel] = useState<{ state: string; fraction: number }>({ state: modelState(), fraction: 0 });
  const [busy, setBusy] = useState(false);
  const thumbs = useMainPhotos();
  const trees = useTrees();
  const shotItems = useLiveQuery(() => db.items.bulkGet(shots), [shots]);

  useEffect(() => {
    let live = true;
    openCamera(video.current!).then((c) => { if (live) cam.current = c; else c.stop(); }).catch(() => live && setNoCamera(true));
    return () => { live = false; cam.current?.stop(); cam.current = null; };
  }, []);

  useEffect(() => {
    if (modelState() === 'ready') return;
    let live = true;
    void modelCached().then((cached) => {
      if (!live) return;
      setModel({ state: cached ? 'loading' : 'downloading', fraction: 0 });
      loadModel((f) => live && setModel({ state: cached ? 'loading' : 'downloading', fraction: f }))
        .then(() => live && setModel({ state: 'ready', fraction: 1 }))
        .catch(() => live && setModel({ state: 'failed', fraction: 0 }));
    });
    return () => { live = false; };
  }, []);

  useEffect(() => onCutoutLanded((_id, ok) => { if (!ok) showToast("Couldn't separate that piece from the background. Try a plain surface."); }), []);

  const take = async (get: () => Promise<ImageBitmap>) => {
    if (busy) return;
    setBusy(true);
    try {
      const bmp = await get();
      setFlash((f) => f + 1);
      navigator.vibrate?.(10);
      if (retake) {
        await retakeShot(retake, bmp);
        back(); // to the piece, which shows "Cutting out…" until the new cut-out lands
        return;
      }
      const id = await addShot(bmp, scope);
      setShots((s) => [id, ...s]);
    } catch (e) {
      showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't take that photo");
    } finally {
      setBusy(false);
    }
  };

  const files = async (list: FileList | null) => {
    for (const f of Array.from(list ?? [])) await take(() => bitmapFromFile(f));
  };

  return (
    <main className="camera">
      <div className="viewfinder">
        <video ref={video} playsInline muted aria-label="Camera" />
        {flash > 0 && <span key={flash} className="flash" aria-hidden="true" />}
        <span className="cam-hint">{retake ? 'Retake: lay it flat on a plain surface' : 'Lay it flat on a plain surface, whole piece in frame'}</span>
        {model.state !== 'ready' && model.state !== 'missing' && (
          <span className="cam-model" role="status">
            {model.state === 'failed' ? 'Cut-outs will be done when the tool can load. Keep shooting.'
              : model.state === 'downloading' ? `Getting the cut-out tool, once: ${Math.round(model.fraction * 100)}%`
              : 'Getting the cut-out tool ready'}
          </span>
        )}
        {noCamera && (
          <div className="cam-none">
            <p>The camera did not open. You can take or pick photos instead.</p>
            <label className="acc">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void files(e.target.files); e.target.value = ''; }} /></label>
          </div>
        )}
      </div>
      <div className="cam-panel">
        <div className="cam-strip">
          {(shotItems ?? []).filter(Boolean).slice(0, 4).map((i) => {
            const t = thumbs?.get(i!.id);
            return (
              <Window key={i!.id} className="cam-thumb" colour={trees ? pieceColour(i!, trees.shades) : undefined}>
                <Piece src={t?.url} cut={t?.cut} />
              </Window>
            );
          })}
          <span className="m" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <Numeral value={shots.length} roll={false} className="cam-n" /> shot
          </span>
        </div>
        <div className="cam-row">
          <label className="link" style={{ color: 'var(--m)', fontWeight: 400 }}>
            From photos
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { void files(e.target.files); e.target.value = ''; }} />
          </label>
          <button type="button" className="shutter" aria-label="Take a photo" disabled={noCamera || busy} onClick={() => cam.current && take(cam.current.shoot)}>
            <span />
          </button>
          {shots.length ? (
            <button type="button" className="acc" onClick={() => go('/details', { from: 'camera' }, { replace: true })}>Done</button>
          ) : (
            <button type="button" className="link" style={{ color: 'var(--m)', fontWeight: 400 }} onClick={() => back()}>Cancel</button>
          )}
        </div>
      </div>
    </main>
  );
}
