import { useEffect, useState } from 'react';
import { addKind, emptyTrash, OTHER_KIND, removeKind, rename, restore, setKindHidden, setKindLane, setSetting, TRASH_DAYS, undoLast } from '../db/actions';
import { Chips } from '../ui/Chips';
import type { Lane } from '../domain/types';
import { db } from '../db/db';
import { useItems, useMainPhotos, useSetting, useTrashed, useTrees } from '../db/hooks';
import { toCsv } from '../domain/csv';
import { dayText, plural } from '../domain/format';
import type { Kind } from '../domain/types';
import { backFromGoogle } from '../backup/google';
import { backupToDrive, CLIENT_ID_KEY } from '../backup/drive';
import { exportAll, importAll } from '../backup/file';
import { parseStarter } from '../backup/starter';
import { isUnsorted } from '../domain/fields';
import { askConfirm, askText } from '../ui/Ask';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { IconChev } from '../ui/icons';
import { SubTop } from './shared';
import { StaplesSection } from './Staples';

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const today = () => new Date().toISOString().slice(0, 10);
const mb = (n: number) => (n < 1e9 ? `${Math.max(0.1, n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB` : `${(n / 1e9).toFixed(1)} GB`);

/** Kinds, backup and trash. */
export function Settings() {
  const last = useSetting<number | null>('backup.last', null);
  const clientId = useSetting<string>(CLIENT_ID_KEY, '');
  const items = useItems();
  const trees = useTrees();
  const trashed = useTrashed();
  const thumbs = useMainPhotos();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [used, setUsed] = useState<{ usage: number; quota: number } | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  useEffect(() => {
    const back = backFromGoogle();
    if (back) setNote(back);
    navigator.storage?.estimate?.().then((e) => setUsed({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
  }, [last]);

  const run = async (label: string, job: () => Promise<string | void>) => {
    setBusy(label);
    setNote(null);
    try {
      const msg = await job();
      if (msg) setNote(msg);
    } catch (e) {
      setNote((e as Error).message || 'That didn’t work. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  };

  const pick = (accept: string, then: (f: File) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => { const f = input.files?.[0]; if (f) then(f); };
    input.click();
  };

  if (!items || !trees || !trashed) return <main className="screen" aria-busy="true" />;
  const tops = trees.kinds.filter((k) => !k.parentId && !isUnsorted(k.id)); // "Not sorted yet" is fixed: not renamed or removed

  return (
    <main className="screen">
      <SubTop title="Settings" />

      <h2 className="caps m" style={{ padding: '14px 18px 4px' }}>Backup</h2>
      <p style={{ padding: '4px 18px 10px' }}>{last ? `Last backup ${dayText(last)}, ${new Date(last).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.` : 'Not backed up yet.'}</p>
      <div className="settings-actions">
        {clientId ? (
          <button type="button" className="acc wide" disabled={!!busy} onClick={() => run('drive', async () => {
            const { uploaded } = await backupToDrive();
            return `Backed up to Google Drive. ${uploaded ? `${plural(uploaded, 'new photo')} sent.` : 'No new photos to send.'}`;
          })}>{busy === 'drive' ? 'Backing up…' : 'Back up now'}</button>
        ) : (
          <button type="button" className="ghost wide" disabled={!!busy} onClick={() => pick('.json,application/json', (f) => void run('starter', async () => {
            const { googleClientId } = parseStarter(await f.text());
            await setSetting(CLIENT_ID_KEY, googleClientId);
            return 'Google Drive backup is set up. Tap Back up now.';
          }))}>Set up Drive backup with the starter file</button>
        )}
        <button type="button" className="ghost wide" disabled={!!busy} onClick={() => run('file', async () => {
          save(await exportAll(), `inventory-${today()}.zip`);
          return 'Backup file saved to Downloads.';
        })}>{busy === 'file' ? 'Saving…' : 'Save a backup file'}</button>
        <button type="button" className="ghost wide" disabled={!!busy} onClick={() => pick('.zip,application/zip', (f) => void run('restore', async () => {
          if (!(await askConfirm('Replace everything on this phone with this backup?', 'Replace'))) return;
          const r = await importAll(f);
          return `Restored ${plural(r.items, 'piece')} and ${plural(r.photos, 'photo')}.`;
        }))}>Restore from a file</button>
        <button type="button" className="ghost wide" disabled={!!busy} onClick={() => run('csv', async () => {
          save(new Blob(['﻿', toCsv(items, trees)], { type: 'text/csv' }), `inventory-${today()}.csv`);
          return 'Spreadsheet saved to Downloads.';
        })}>Export a spreadsheet</button>
      </div>
      {note && <p role="status" style={{ padding: '10px 18px 0' }}>{note}</p>}
      {used && used.usage > 0 && (
        <p className="m" style={{ padding: '12px 18px 0' }}>Using {mb(used.usage)} on this phone{used.quota ? ` of ${mb(used.quota)} allowed` : ''}.</p>
      )}

      <h2 className="caps m" style={{ padding: '26px 18px 4px' }}>Trash</h2>
      <button type="button" className="li" onClick={() => setTrashOpen(true)}>
        <span>{trashed.length ? plural(trashed.length, 'piece') : 'Empty'}</span>
        <span className="m sm">kept {TRASH_DAYS} days</span>
        <span className="n"><IconChev /></span>
      </button>

      <h2 className="caps m" style={{ padding: '26px 18px 4px' }}>Kinds</h2>
      {tops.map((k) => (
        <div key={k.id}>
          <button type="button" className="li" onClick={() => setKind(k)}>
            <span>{k.name}</span>
            {k.hideFromWindow && <span className="m sm">not in the window</span>}
            <span className="n"><IconChev /></span>
          </button>
          {trees.kinds.filter((c) => c.parentId === k.id).map((c) => (
            <button key={c.id} type="button" className="li" style={{ paddingLeft: 38 }} onClick={() => setKind(c)}>
              <span>{c.name}</span>
              {c.hideFromWindow && <span className="m sm">not in the window</span>}
              <span className="n"><IconChev /></span>
            </button>
          ))}
        </div>
      ))}
      <div style={{ padding: '10px 18px 24px' }}>
        <button type="button" className="ghost wide" onClick={async () => {
          const name = await askText('A new kind', 'For example: Bags');
          if (name?.trim()) await addKind(name, null, false);
        }}>Add a kind</button>
      </div>

      {trees && <StaplesSection trees={trees} />}

      <KindSheet kind={kind} onClose={() => setKind(null)} />
      <Sheet open={trashOpen} onClose={() => setTrashOpen(false)} label="Trash">
        <div style={{ display: 'grid', gap: 10 }}>
          <p className="name" style={{ fontSize: 22 }}>Trash</p>
          {trashed.length === 0 && <p className="m">Nothing in the trash.</p>}
          {trashed.map((i) => (
            <div key={i.id} className="trash-row">
              {thumbs?.get(i.id) ? <img src={thumbs.get(i.id)!.url} alt="" /> : <span className="trash-blank" />}
              <span style={{ minWidth: 0 }}>{i.name}<br /><span className="m sm">gone for good {dayText(i.deletedAt! + TRASH_DAYS * 864e5)}</span></span>
              <button type="button" className="ghost" style={{ marginLeft: 'auto' }} onClick={() => void restore([i.id])}>Bring back</button>
            </div>
          ))}
          {trashed.length > 0 && (
            <button type="button" className="ghost" onClick={async () => {
              if (!(await askConfirm(`Delete ${plural(trashed.length, 'piece')} for good? This can't be undone.`, 'Delete for good'))) return;
              const n = await emptyTrash();
              showToast(`${plural(n, 'piece')} deleted for good`);
              setTrashOpen(false);
            }}>Empty the trash</button>
          )}
        </div>
      </Sheet>
    </main>
  );
}

/** The outfit lanes in plain words. */
const LANES: [Lane | 'none', string][] = [['head', 'Head'], ['neck', 'Neck'], ['top', 'Top'], ['waist', 'Waist'], ['bottom', 'Bottom'], ['feet', 'Feet'], ['wrist', 'Wrist'], ['hand', 'Hand'], ['carry', 'Carried'], ['none', 'Not set']];

function KindSheet({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  if (!kind) return <Sheet open={false} onClose={onClose} label="Kind">{null}</Sheet>;
  const removable = kind.id !== OTHER_KIND;
  return (
    <Sheet open onClose={onClose} label={kind.name}>
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="name" style={{ fontSize: 22 }}>{kind.name}</p>
        <button type="button" className="ghost" onClick={async () => {
          const name = await askText('Rename', kind.name, kind.name);
          if (name?.trim()) await rename('kinds', kind.id, name.trim());
          onClose();
        }}>Rename</button>
        <button type="button" className="ghost" onClick={async () => { await setKindHidden(kind.id, !kind.hideFromWindow); onClose(); }}>
          {kind.hideFromWindow ? 'Show in the window again' : 'Keep out of the window'}
        </button>
        {kind.clothing && (
          <div className="q">
            <p className="ql">Where it goes in outfits</p>
            <Chips label="Where it goes in outfits" value={kind.lane ?? 'none'} onChange={async (v) => { await setKindLane(kind.id, v === 'none' ? undefined : (v as Lane)); onClose(); }}
              options={LANES.map(([value, label]) => ({ value, label }))} />
          </div>
        )}
        {!kind.parentId && (
          <button type="button" className="ghost" onClick={async () => {
            const name = await askText(`A kind inside ${kind.name}`, 'For example: Linen shirts');
            if (name?.trim()) await addKind(name, kind.id, kind.clothing);
            onClose();
          }}>Add a kind inside</button>
        )}
        {removable && (
          <button type="button" className="ghost" onClick={async () => {
            const n = await db.items.where('kindId').equals(kind.id).count();
            if (!(await askConfirm(`Remove ${kind.name}?${n ? ` Its ${plural(n, 'piece')} move to ${kind.parentId ? 'the kind above' : 'Other'}.` : ''}`, 'Remove'))) return;
            await removeKind(kind.id);
            showToast(`Removed ${kind.name}`, () => void undoLast());
            onClose();
          }}>Remove</button>
        )}
      </div>
    </Sheet>
  );
}
