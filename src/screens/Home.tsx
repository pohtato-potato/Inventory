import type React from 'react';
import { logWear, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfits, useToday, useTrees, useWears, useWishes } from '../db/hooks';
import { homeCards, homeStats, type Card } from '../domain/home';
import type { Item, Outfit, Wear } from '../domain/types';
import { dayStart, suggestWords } from '../domain/wearlog';
import { wearLine } from '../domain/wears';
import { go } from '../router';
import { Numeral } from '../ui/Numeral';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { Swatch, Cut } from '../ui/Swatch';
import { NoPhoto } from '../ui/kindIcons';
import { kindGroup } from '../domain/kinds';
import { IconChev } from '../ui/icons';
import { Mini, openItem, pieceColour, Top, type Thumb, type Trees } from './shared';
import { GladCard } from './Wishes';

const agoText = (n: number) => (n === 1 ? 'a year ago' : `${n} years ago`);
const yearsText = (n: number) => (n === 1 ? 'a year' : `${n} years`);
const owned = (i: Item | undefined) => !!i && i.status === 'owned' && i.deletedAt === undefined;

const SHORTCUTS: [string, string][] = [['Log wear', '/wear'], ['Add a piece', '/add'], ['Do I own this?', '/own'], ['My sizes', '/sizes'], ['Numbers', '/numbers']];

/** Four numbers always shown under the date, each opening where it was counted. */
function HomeStats({ stats }: { stats: ReturnType<typeof homeStats> }) {
  const cells: { n: number; label: string; where: string; open: () => void; fit?: boolean }[] = [
    { n: stats.pieces, label: 'Pieces', where: 'pieces owned', open: () => go('/wardrobe') },
    { n: stats.fits, label: 'Fit now', where: 'fit now', open: () => go('/search', { fit: 'fits' }), fit: true },
    { n: stats.wornThisWeek, label: 'Worn this week', where: stats.wornThisWeek === 1 ? 'day worn this week' : 'days worn this week', open: () => go('/wear') },
    { n: stats.wishes, label: 'Wishes', where: stats.wishes === 1 ? 'open wish' : 'open wishes', open: () => go('/wishes') },
  ];
  return (
    <section className="home-stats" aria-label="Your numbers">
      {cells.map((c) => (
        <button key={c.label} type="button" className={`home-stat${c.fit ? ' fit' : ''}`} onClick={c.open} aria-label={`${c.n} ${c.where}`}>
          <Numeral value={c.n} className="home-stat-num" />
          <span className="m sm">{c.label === 'Worn this week' ? <>Worn<br /><span className="nowrap">this week</span></> : c.label}</span>
        </button>
      ))}
    </section>
  );
}

/** Home: today, then the day's cards, each thing on its own colour. */
export function Home() {
  const items = useAllItems();
  const wears = useWears();
  const wishes = useWishes();
  const outfits = useOutfits();
  const trees = useTrees();
  const thumbs = useMainPhotos();
  const today = useToday();
  if (!items || !wears || !wishes || !outfits || !trees || !thumbs) return <main className="screen" aria-busy="true" />;

  const date = new Date(dayStart(today));
  const cards = homeCards({ items, wears, wishes, outfits, today });
  const live = items.filter((i) => i.deletedAt === undefined);
  const day = `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;

  return (
    <main className="screen home">
      <Top title="Home" right={<span className="m home-day">{day}</span>} />
      {cards.map((c, n) => <HomeCard index={n} key={c.type} card={c} items={live} wears={wears} outfits={outfits} trees={trees} thumbs={thumbs} today={today} />)}
      <h2 className="caps m section-cap">Your numbers</h2>
      <HomeStats stats={homeStats({ items, kinds: trees.kinds, wears, wishes, today })} />
      <nav className="home-shortcuts" aria-label="Shortcuts">
        {SHORTCUTS.map(([label, path]) => <button key={path} type="button" className="ghost" onClick={() => go(path)}>{label}</button>)}
      </nav>
    </main>
  );
}

function HomeCard({ card, index, items, wears, outfits, trees, thumbs, today }: { card: Card; index: number; items: Item[]; wears: Wear[]; outfits: Outfit[]; trees: Trees; thumbs: Map<string, Thumb>; today: string }) {
  const byId = (id: string) => items.find((i) => i.id === id);
  switch (card.type) {
    case 'log': {
      if (card.logged) {
        return (
          <section className="card home-log" aria-label="Today">
            <p className="name home-q">What you wore today</p>
            <div className="mini-row">{card.logged.itemIds.map((id) => byId(id)).filter((i) => !!i).map((i) => <Mini key={i.id} item={i} thumb={thumbs.get(i.id)} trees={trees} size={53} />)}</div>
            <p className="m home-line">{wearLine(card.logged, outfits, items)}</p>
            <div className="home-acts"><button type="button" className="ghost" onClick={() => go('/wear')}>Change</button></div>
          </section>
        );
      }
      const s = card.suggestion;
      const ids = s?.itemIds.filter((id) => owned(byId(id))) ?? [];
      const outfitId = ids.length === s?.itemIds.length ? s?.outfitId : undefined;
      const words = s && ids.length ? suggestWords({ itemIds: ids, ...(outfitId ? { outfitId } : {}) }, outfits, wears, today).home : '';
      return (
        <section className="card home-log" aria-label="What did you wear today?">
          <p className="name home-q">What did you wear today?</p>
          {ids.length > 0 && (
            <>
              <div className="mini-row" role="img" aria-label={`Suggested: ${ids.map((id) => byId(id)!.name).join(', ')}`}>
                {ids.map((id) => <Mini key={id} item={byId(id)!} thumb={thumbs.get(id)} trees={trees} size={53} />)}
              </div>
              <p className="m home-line">{words}</p>
            </>
          )}
          <div className="home-acts">
            {ids.length > 0 ? (
              <>
                <button type="button" className="acc" style={{ flex: 1 }} onClick={async () => { await logWear(today, ids, outfitId); showToast('Logged what you wore', () => void undoLast()); }}>Yes, this</button>
                <button type="button" className="ghost" onClick={() => go('/wear')}>Something else</button>
              </>
            ) : (
              <button type="button" className="acc" style={{ flex: 1 }} onClick={() => go('/wear')}>Log it</button>
            )}
          </div>
        </section>
      );
    }
    case 'glad': {
      const item = card.wish.itemId ? byId(card.wish.itemId) : undefined;
      const t = item ? thumbs.get(item.id) : undefined;
      return <GladCard wish={card.wish} photo={t?.url} cut={t?.cut} colour={item ? pieceColour(item, trees) : undefined} today={today} />;
    }
    case 'needsDetails':
      return (
        <button type="button" className="li home-li" onClick={() => go('/details')}>
          <span><b>{card.count}</b> {card.count === 1 ? 'piece needs details' : 'pieces need details'}</span>
          <span className="n"><IconChev /></span>
        </button>
      );
    case 'onThisDay':
      return (
        <section className="home-otd" aria-label="On this day">
          <h2 className="caps m section-cap">On this day</h2>
          {card.list.slice(0, 4).map((x) => (
            <DayCard key={`${x.what}-${x.item.id}`} item={x.item} thumb={thumbs.get(x.item.id)} trees={trees} index={index}
              line={<>{x.what === 'bought' ? 'Bought' : 'Worn'} {agoText(x.years)} today</>} />
          ))}
        </section>
      );
    case 'anniversary':
      return (
        <section className="home-otd" aria-label="Anniversaries">
          {card.list.slice(0, 3).map((x) => (
            <DayCard key={x.item.id} item={x.item} thumb={thumbs.get(x.item.id)} trees={trees} index={index}
              line={<><b>{yearsText(x.years)}</b> with it today</>} />
          ))}
        </section>
      );
    case 'recent':
      return (
        <section className="home-recent" aria-label="Recently added">
          <h2 className="caps m section-cap">Recently added</h2>
          <div className="grid">
            {card.items.map((i, n) => (
              <Tile key={i.id} item={i} group={kindGroup(i.kindId, trees.kinds)} photo={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut} colour={pieceColour(i, trees)} index={n} onPress={() => openItem(i.id)} />
            ))}
          </div>
        </section>
      );
    case 'year':
      return (
        <button type="button" className="li home-li" onClick={() => go('/year')}>
          <span className="name" style={{ fontSize: 22 }}>Your {card.year} in review</span>
          <span className="n"><IconChev /></span>
        </button>
      );
  }
}

/** A thing remembered today, on its own colour: its photo, its name, and why it is here. */
function DayCard({ item, thumb, trees, line, index }: { item: Item; thumb?: Thumb; trees: Trees; line: React.ReactNode; index: number }) {
  return (
    <Swatch as="button" type="button" tone="page" className="day-card rise" delay={index * 60} colour={pieceColour(item, trees)} onClick={() => openItem(item.id)}>
      <span className="day-card-pic">{thumb ? <Cut src={thumb.url} cut={thumb.cut} /> : <NoPhoto group={kindGroup(item.kindId, trees.kinds)} size={28} />}</span>
      <span className="day-card-text"><span className="name">{item.name}</span><span className="tint">{line}</span></span>
    </Swatch>
  );
}
