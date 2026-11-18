import { useEffect, useState } from 'react';
import { addKind, emptyTrash, OTHER_KIND, removeKind, rename, restore, setKindLane, setSetting, TRASH_DAYS, undoLast } from '../db/actions';
import { Chips } from '../ui/Chips';
import type { Lane } from '../domain/types';
import { LANE_WORDS } from '../domain/outfit';
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
import type { CSSProperties, ReactNode } from 'react';
import { IconChev, IconCloud, IconSave, IconTable, IconTrash, IconUpload } from '../ui/icons';
import { GROUP_NAME, groupColour, KIND_GROUPS, KIND_PALETTE, kindGroup, type KindGroup } from '../domain/kinds';
import { go } from '../router';
import { SubTop } from './shared';

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
  const [group, setGroup] = useState<KindGroup | null>(null);
  const own = useSetting<Partial<Record<KindGroup, string>>>('kindColours', {});

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
    <main className="screen settings">
      <SubTop title="Settings" />

      <h2 className="caps m section-cap">Backup</h2>
      <div className="set-rows">
        {clientId ? (
          <SetRow icon={<IconCloud />} colour="#2F63D6" busy={busy === 'drive'} disabled={!!busy}
            title={busy === 'drive' ? 'Backing up…' : 'Back up now'}
            sub={last ? `Google Drive, last saved ${dayText(last)}, ${new Date(last).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Google Drive. Not backed up yet.'}
            onClick={() => run('drive', async () => {
              const { uploaded } = await backupToDrive();
              return `Backed up to Google Drive. ${uploaded ? `${plural(uploaded, 'new photo')} sent.` : 'No new photos to send.'}`;
            })} />
        ) : (
          <SetRow icon={<IconCloud />} colour="#2F63D6" disabled={!!busy} title="Set up Drive backup with the starter file"
            sub={last ? `Last backup ${dayText(last)}` : 'Not backed up yet.'}
            onClick={() => pick('.json,application/json', (f) => void run('starter', async () => {
              const { googleClientId } = parseStarter(await f.text());
              await setSetting(CLIENT_ID_KEY, googleClientId);
              return 'Google Drive backup is set up. Tap Back up now.';
            }))} />
        )}
        <SetRow icon={<IconSave />} colour="#3D7A22" disabled={!!busy} title={busy === 'file' ? 'Saving…' : 'Save a backup file'} sub="Everything, photos too, in one file"
          onClick={() => run('file', async () => {
            save(await exportAll(), `inventory-${today()}.zip`);
            return 'Backup file saved to Downloads.';
          })} />
        <SetRow icon={<IconUpload />} colour="#7E52C0" disabled={!!busy} title="Restore from a file" sub="Replaces what is on this phone"
          onClick={() => pick('.zip,application/zip', (f) => void run('restore', async () => {
            if (!(await askConfirm('Replace everything on this phone with this backup?', 'Replace'))) return;
            const r = await importAll(f);
            return `Restored ${plural(r.items, 'piece')} and ${plural(r.photos, 'photo')}.`;
          }))} />
        <SetRow icon={<IconTable />} colour="#985A0D" disabled={!!busy} title="Export a spreadsheet" sub="A CSV file for any spreadsheet app"
          onClick={() => run('csv', async () => {
            save(new Blob(['\uFEFF', toCsv(items, trees)], { type: 'text/csv' }), `inventory-${today()}.csv`);
            return 'Spreadsheet saved to Downloads.';
          })} />
        <SetRow icon={<IconTrash />} colour="#59626D" title="Trash" sub={trashed.length ? `${plural(trashed.length, 'thing')}, emptied after ${TRASH_DAYS} days` : `Empty. Deleted things stay ${TRASH_DAYS} days.`}
          onClick={() => setTrashOpen(true)} />
      </div>
      {note && <p role="status" className="page-lede">{note}</p>}
      {used && used.usage > 0 && (
        <p className="m page-lede">Using {mb(used.usage)} on this phone{used.quota ? ` of ${mb(used.quota)} allowed` : ''}.</p>
      )}

      <h2 className="caps m section-cap">Kinds and their colours</h2>
      <p className="m page-lede">Things with no photo, dots and bars use their kind's colour. Tap one to change it.</p>
      <div className="set-groups">
        {KIND_GROUPS.map((g) => {
          const n = items.filter((i) => i.status === 'owned' && kindGroup(i.kindId, trees.kinds) === g).length;
          return (
            <button key={g} type="button" className="li" onClick={() => setGroup(g)}>
              <span className="dot lg" style={{ background: groupColour(g) }} />
              <span>{GROUP_NAME[g]}</span>
              <span className="m sm">{n}</span>
              <span className="n"><IconChev /></span>
            </button>
          );
        })}
      </div>

      <h2 className="caps m section-cap">Kinds</h2>
      {tops.map((k) => (
        <div key={k.id}>
          <button type="button" className="li" onClick={() => setKind(k)}>
            <span className="dot" style={{ background: groupColour(kindGroup(k.id, trees.kinds)) }} />
            <span>{k.name}</span>
            <span className="n"><IconChev /></span>
          </button>
          {trees.kinds.filter((c) => c.parentId === k.id).map((c) => (
            <button key={c.id} type="button" className="li sub-li" onClick={() => setKind(c)}>
              <span>{c.name}</span>
              <span className="n"><IconChev /></span>
            </button>
          ))}
        </div>
      ))}
      <div className="page-acts">
        <button type="button" className="ghost wide" onClick={async () => {
          const name = await askText('A new kind', 'For example: Bags');
          if (name?.trim()) await addKind(name, null, false);
        }}>Add a kind</button>
      </div>

      <h2 className="caps m section-cap">Wishes</h2>
      <button type="button" className="li" onClick={() => go('/staples')}>
        <span>Staples</span>
        <span className="m sm">the basics Wishes looks for</span>
        <span className="n"><IconChev /></span>
      </button>

      <GroupSheet group={group} own={own} onClose={() => setGroup(null)} />
      <KindSheet kind={kind} onClose={() => setKind(null)} />
      <Sheet open={trashOpen} onClose={() => setTrashOpen(false)} label="Trash">
        <div className="sheet-body">
          <p className="name">Trash</p>
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
const LANES: [Lane | 'none', string][] = [...LANE_WORDS, ['none', 'Not set']];

function KindSheet({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  if (!kind) return <Sheet open={false} onClose={onClose} label="Kind">{null}</Sheet>;
  const removable = kind.id !== OTHER_KIND;
  return (
    <Sheet open onClose={onClose} label={kind.name}>
      <div className="sheet-body">
        <p className="name">{kind.name}</p>
        <button type="button" className="ghost" onClick={async () => {
          const name = await askText('Rename', kind.name, kind.name);
          if (name?.trim()) await rename('kinds', kind.id, name.trim());
          onClose();
        }}>Rename</button>
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

/** A settings row: an icon in its own coloured square, what it does, and a line under it. */
function SetRow({ icon, colour, title, sub, onClick, disabled, busy }: { icon: ReactNode; colour: string; title: string; sub: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button type="button" className="set-row" disabled={disabled} aria-busy={busy || undefined} onClick={onClick}>
      <span className="set-icon" style={{ '--k': colour } as CSSProperties}>{icon}</span>
      <span className="set-text"><span className="b">{title}</span><span className="m sm">{sub}</span></span>
      <span className="n"><IconChev /></span>
    </button>
  );
}

/** A kind's colour: one of the palette, kept in settings. Clothing shares one colour. */
function GroupSheet({ group, own, onClose }: { group: KindGroup | null; own: Partial<Record<KindGroup, string>>; onClose: () => void }) {
  if (!group) return <Sheet open={false} onClose={onClose} label="Kind colour">{null}</Sheet>;
  const cur = groupColour(group);
  const pick = async (hex: string) => {
    const before = own;
    await setSetting('kindColours', { ...own, [group]: hex });
    showToast(`${GROUP_NAME[group]} recoloured`, () => void setSetting('kindColours', before));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} label={`${GROUP_NAME[group]} colour`}>
      <div className="sheet-body">
        <p className="name">{GROUP_NAME[group]}</p>
        <p className="m">{group === 'clothes' ? 'Every kind of clothing shares this colour.' : 'Used for its dots, bars and things with no photo.'}</p>
        <div className="swatches" role="radiogroup" aria-label={`${GROUP_NAME[group]} colour`}>
          {KIND_PALETTE.map((hex) => (
            <button key={hex} type="button" role="radio" aria-checked={hex === cur} aria-label={hex} className={`swatch${hex === cur ? ' on' : ''}`} style={{ background: hex }} onClick={() => void pick(hex)} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
