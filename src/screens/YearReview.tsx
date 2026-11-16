import { useState } from 'react';
import { useAllItems, useMainPhotos, useOutfits, useTrees, useWears } from '../db/hooks';
import { money, plural } from '../domain/format';
import { reviewYear, yearRooms, yearTotals } from '../domain/home';
import { dayKey } from '../domain/wearlog';
import { useRoute } from '../router';
import { Numeral } from '../ui/Numeral';
import { Piece, Window } from '../ui/Window';
import { pieceColour, SubTop } from './shared';

/** The year in review: one screen per room, swiped sideways, then the whole year. */
export function YearReview() {
  const { params } = useRoute();
  const items = useAllItems();
  const wears = useWears();
  const trees = useTrees();
  const thumbs = useMainPhotos();
  const outfits = useOutfits();
  const [at, setAt] = useState(0);
  if (!items || !wears || !trees || !thumbs || !outfits) return <main className="screen" aria-busy="true" />;

  const asked = Number(params.get('y'));
  const year = Number.isInteger(asked) && asked > 2000 ? asked : reviewYear(dayKey(Date.now()));
  const rooms = yearRooms(items, wears, trees.places, year);
  const total = yearTotals(items, wears, trees, year, outfits);
  const count = rooms.length + 1;

  return (
    <main className="screen year">
      <SubTop title={`Your ${year}`} right={<span className="m" aria-live="polite" style={{ paddingRight: 10 }}>{at + 1} of {count}</span>} />
      <div className="year-track" onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {rooms.map((r, i) => (
          <section key={r.place.id} className="year-slide" aria-label={`${r.place.name}, ${i + 1} of ${count}`}>
            <Window className="year-win" colour={r.mostWorn ? pieceColour(r.mostWorn, trees.shades) : undefined} lit={!!r.mostWorn}>
              <p className="caps year-place">{r.place.name}</p>
              <div className="year-pc"><Piece src={r.mostWorn ? thumbs.get(r.mostWorn.id)?.url : undefined} cut={r.mostWorn ? thumbs.get(r.mostWorn.id)?.cut ?? true : true} alt={r.mostWorn?.name ?? ''} /></div>
              <p className="year-cap">{r.mostWorn ? <><span className="m">Most worn here</span> <b>{r.mostWorn.name}</b> · {plural(r.mostWornN ?? 0, 'wear')}</> : <span className="m">Nothing worn here this year</span>}</p>
            </Window>
            <div className="year-nums three">
              <Stat n={r.added} one="piece added" many="pieces added" />
              <Stat n={r.wears} one="wear" many="wears" />
              <Stat n={r.letGo} one="let go" many="let go" />
            </div>
          </section>
        ))}
        <section className="year-slide" aria-label={`The whole year, ${count} of ${count}`}>
          <Window className="year-win all" colour={total.mostWorn ? pieceColour(total.mostWorn, trees.shades) : undefined} lit={!!total.mostWorn}>
            <p className="caps year-place">The whole year</p>
            {total.mostWorn ? (
              <>
                <div className="year-pc right"><Piece src={thumbs.get(total.mostWorn.id)?.url} cut={thumbs.get(total.mostWorn.id)?.cut ?? true} alt={total.mostWorn.name} /></div>
                <p className="year-best"><span className="m">Most worn piece</span><br /><b>{total.mostWorn.name}</b><br /><Numeral value={total.mostWornN ?? 0} className="year-best-num" /> <span className="m">{(total.mostWornN ?? 0) === 1 ? 'day' : 'days'}</span></p>
              </>
            ) : <p className="year-best"><span className="m">No wears logged this year</span></p>}
          </Window>
          <div className="year-nums two">
            <Stat n={total.added} one="piece added" many="pieces added" />
            <Stat n={total.wears} one="day logged" many="days logged" />
            <Stat n={total.letGo} one="let go" many="let go" />
            <Stat n={total.outfitsSaved} one="outfit saved" many="outfits saved" />
          </div>
          <p className="caps m year-spend-cap">Spent on new pieces</p>
          {total.spend.length > 0 ? (
            total.spend.map((s) => <p key={s.currency} className="spend-total year-spend"><span className="num">{money(s.total, s.currency)}</span>{s.estimated ? <span className="m sm"> about</span> : null}</p>)
          ) : (
            <p className="m year-spend">No prices for what you bought this year.</p>
          )}
          {rooms.length === 0 && <p className="m year-spend" style={{ paddingTop: 10 }}>Rooms appear here once wears are logged.</p>}
        </section>
      </div>
      {count > 1 && (
        <div className="year-dots" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => <span key={i} className={i === at ? 'on' : undefined} />)}
        </div>
      )}
      {count > 1 && <p className="m year-hint" aria-hidden="true">{at < count - 1 ? 'Swipe for the next room' : 'Swipe back to see the rooms'}</p>}
    </main>
  );
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <div className="year-stat">
      <Numeral value={n} className="year-num" />
      <p className="caps m">{n === 1 ? one : many}</p>
    </div>
  );
}
