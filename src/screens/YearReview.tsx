import { useState } from 'react';
import { useAllItems, useMainPhotos, useTrees, useWears } from '../db/hooks';
import { money } from '../domain/format';
import { reviewYear, yearRooms, yearTotals } from '../domain/home';
import type { Item } from '../domain/types';
import { dayKey } from '../domain/wearlog';
import { useRoute } from '../router';
import { Numeral } from '../ui/Numeral';
import { Piece, Window } from '../ui/Window';
import { pieceColour, SubTop, type Thumb, type Trees } from './shared';

/** The year in review: one screen per room, swiped sideways, then the whole year. */
export function YearReview() {
  const { params } = useRoute();
  const items = useAllItems();
  const wears = useWears();
  const trees = useTrees();
  const thumbs = useMainPhotos();
  const [at, setAt] = useState(0);
  if (!items || !wears || !trees || !thumbs) return <main className="screen" aria-busy="true" />;

  const asked = Number(params.get('y'));
  const year = Number.isInteger(asked) && asked > 2000 ? asked : reviewYear(dayKey(Date.now()));
  const rooms = yearRooms(items, wears, trees.places, year);
  const total = yearTotals(items, wears, trees, year);
  const count = rooms.length + 1;

  return (
    <main className="screen year">
      <SubTop title={`Your ${year}`} right={<span className="m sm" aria-live="polite" style={{ paddingRight: 10 }}>{at + 1} of {count}</span>} />
      <div className="year-track" onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {rooms.map((r, i) => (
          <section key={r.place.id} className="year-slide" aria-label={`${r.place.name}, ${i + 1} of ${count}`}>
            <YearWindow item={r.mostWorn} trees={trees} thumbs={thumbs} caption={r.mostWorn ? `Most worn: ${r.mostWorn.name}` : 'Nothing worn here'} />
            <h2 className="name year-room">{r.place.name}</h2>
            <div className="year-nums">
              <Stat n={r.added} one="piece added" many="pieces added" />
              <Stat n={r.wears} one="wear" many="wears" />
              <Stat n={r.letGo} one="let go" many="let go" />
            </div>
          </section>
        ))}
        <section className="year-slide" aria-label={`The whole year, ${count} of ${count}`}>
          <YearWindow item={total.mostWorn} trees={trees} thumbs={thumbs} caption={total.mostWorn ? `Most worn of the year: ${total.mostWorn.name}` : 'No wears logged this year'} />
          <h2 className="name year-room">All of {year}</h2>
          <div className="year-nums">
            <Stat n={total.added} one="piece added" many="pieces added" />
            <Stat n={total.wears} one="day logged" many="days logged" />
          </div>
          {total.spend.length > 0 ? (
            <div className="year-spend">
              <p className="caps m">Spent on what you bought</p>
              {total.spend.map((s) => <p key={s.currency} className="spend-total"><span className="m sm">{s.estimated ? 'about ' : ''}</span>{money(s.total, s.currency)}</p>)}
            </div>
          ) : (
            <p className="m">No prices for what you bought this year.</p>
          )}
          {rooms.length === 0 && <p className="m" style={{ paddingTop: 10 }}>Rooms appear here once pieces have spots and wears are logged.</p>}
        </section>
      </div>
      {count > 1 && <p className="m sm year-hint" aria-hidden="true">{at < count - 1 ? 'Swipe for the next room' : 'Swipe back to see the rooms'}</p>}
    </main>
  );
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <div className="year-stat">
      <Numeral value={n} className="year-num" />
      <p className="caps m sm">{n === 1 ? one : many}</p>
    </div>
  );
}

function YearWindow({ item, trees, thumbs, caption }: { item?: Item; trees: Trees; thumbs: Map<string, Thumb>; caption: string }) {
  const t = item ? thumbs.get(item.id) : undefined;
  return (
    <figure className="year-fig">
      <Window className="year-win" colour={item ? pieceColour(item, trees.shades) : undefined} lit={!!item}>
        <Piece src={t?.url} cut={t?.cut} alt={item?.name ?? ''} />
      </Window>
      <figcaption className="m sm">{caption}</figcaption>
    </figure>
  );
}
