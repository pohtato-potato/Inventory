import { useRef, useState, type ReactNode } from 'react';
import { createItemWithPhoto, NO_SPACE } from '../db/actions';
import { UNSORTED } from '../domain/fields';
import { groupColour } from '../domain/kinds';
import { bitmapFromFile } from '../photo/camera';
import { addShot } from '../photo/conveyor';
import { go } from '../router';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { IconCamera, IconImage, IconPencil, IconReceipt } from '../ui/icons';

/** A receipt picked on the + sheet, read by the new thing's Details as soon as it opens. */
let pendingReceipt: File | null = null;
export function takePendingReceipt(): File | null {
  const f = pendingReceipt;
  pendingReceipt = null;
  return f;
}

/** The + sheet: four ways to add, each in its own colour. Photo and receipt pickers open from the tap itself. */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const photo = useRef<HTMLInputElement>(null);
  const receipt = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const blank = async () => createItemWithPhoto({ name: 'New piece', kindId: UNSORTED.things, needsDetails: true }, []);
  const fromPhoto = async (f: File) => {
    setBusy(true);
    try {
      const id = await addShot(await bitmapFromFile(f), 'things');
      onClose();
      go('/details', { id });
    } catch (e) {
      showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't open that photo");
    } finally {
      setBusy(false);
    }
  };
  const fromReceipt = async (f: File) => {
    pendingReceipt = f;
    const id = await blank();
    onClose();
    go('/details', { id, edit: '1' });
  };

  return (
    <Sheet open={open} onClose={onClose} label="Add">
      <div className="sheet-grip" aria-hidden="true" />
      <p className="name" style={{ paddingBottom: 14 }}>Add</p>
      <div className="add-ways">
        <Way colour="var(--t)" ink icon={<IconCamera />} title="Take photos" sub="Lay things flat, shoot one after another" onClick={() => { onClose(); go('/add'); }} />
        <Way colour={groupColour('electronics')} icon={<IconImage />} title="Photo from a shop" sub="A screenshot or saved picture" disabled={busy} onClick={() => photo.current?.click()} />
        <Way colour={groupColour('home')} icon={<IconPencil />} title="Without a photo" sub="Name, kind and place" onClick={async () => { const id = await blank(); onClose(); go('/details', { id, edit: '1' }); }} />
        <Way colour={groupColour('bags')} icon={<IconReceipt />} title="Read a receipt" sub="Fills in price and date" onClick={() => receipt.current?.click()} />
      </div>
      <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromPhoto(f); e.target.value = ''; }} />
      <input ref={receipt} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromReceipt(f); e.target.value = ''; }} />
    </Sheet>
  );
}

function Way({ colour, ink = false, icon, title, sub, onClick, disabled }: { colour: string; ink?: boolean; icon: ReactNode; title: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`add-way rise${ink ? ' ink' : ''}`} style={{ background: colour }} onClick={onClick} disabled={disabled}>
      <span className="add-icon">{icon}</span>
      <span><b>{title}</b><span className="add-sub">{sub}</span></span>
    </button>
  );
}
