import { logWear, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfits, useTrees, useWears, useWishes } from '../db/hooks';
import { homeCards, type Card } from '../domain/home';
import type { Item, Outfit } from '../domain/types';
import { dayKey } from '../domain/wearlog';
import { namesLine, wearLine } from '../domain/wears';
import { go } from '../router';
import { Numeral } from '../ui/Numeral';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { Window } from '../ui/Window';
import { IconChev } from '../ui/icons';
import { OutfitStage } from './Outfits';
import { pieceColour, type Thumb, type Trees } from './shared';
import { GladCard } from './Wishes';

const yearsText = (n: number) => (n === 1 ? 'a year' : `${n} years`);

/** Home: the date, then the day's cards. The app still opens on the wardrobe; Home is a tab. */
export function Home() {
  const items = useAllItems();
  const wears = useWears();
  const wishes = useWishes();
  const outfits = useOutfits();
  const trees = useTrees();
  const thumbs = useMainPhotos();
  if (!items || !wears || !wishes || !outfits || !trees || !thumbs) return <main className="screen" aria-busy="true" />;

  const today = dayKey(Date.now());
  const now = new Date();
  const cards = homeCards({ items, wears, wishes, outfits, today });
  const live = items.filter((i) => i.deletedAt === undefined);

  return (
    <main className="screen home">
      <Window as="section" className="hero home-hero" lit aria-label="Today">
        <div className="top">
          <h1 className="caps">Home</h1>
          <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => go('/numbers')}>Numbers</button>
        </div>
        <div className="hero-count">
          <Numeral value={now.getDate()} className="hero-num" />
          <p className="caps m">{now.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
          <p className="caps m">{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
      </Window>
      {cards.map((c) => <HomeCard key={c.type} card={c} items={live} outfits={outfits} trees={trees} thumbs={thumbs} today={today} />)}
    </main>
  );
}

function HomeCard({ card, items, outfits, trees, thumbs, today }: { card: Card; items: Item[]; outfits: Outfit[]; trees: Trees; thumbs: Map<string, Thumb>; today: string }) {
  const byId = (id: string) => items.find((i) => i.id === id);
  switch (card.type) {
    case 'log': {
      if (card.logged) {
        return (
          <section className="card" aria-label="Today">
            <p className="m sm">Logged today</p>
            <p className="home-line">{wearLine(card.logged, outfits, items)}</p>
            <button type="button" className="link card-link" onClick={() => go('/wear')}>Change</button>
          </section>
        );
      }
      const s = card.suggestion;
      const ids = s?.itemIds.filter((id) => byId(id)?.status === 'owned') ?? [];
      return (
        <section className="card" aria-label="What did you wear today?">
          <p className="name home-q">What did you wear today?</p>
          {ids.length > 0 && (
            <div className="home-suggest">
              <OutfitStage ids={ids} items={items} trees={trees} thumbs={thumbs} height={170} label={`Suggested: ${namesLine(ids, items)}`} />
              <p className="m">{s?.outfitId ? outfits.find((o) => o.id === s.outfitId)?.name ?? namesLine(ids, items) : namesLine(ids, items)}</p>
            </div>
          )}
          <div className="home-acts">
            {ids.length > 0 ? (
              <>
                <button type="button" className="acc" onClick={async () => { await logWear(today, ids, s?.outfitId); showToast('Logged what you wore', () => void undoLast()); }}>Log it</button>
                <button type="button" className="ghost" onClick={() => go('/wear')}>Something else</button>
              </>
            ) : (
              <button type="button" className="acc" onClick={() => go('/wear')}>Log it</button>
            )}
          </div>
        </section>
      );
    }
    case 'glad': {
      const item = card.wish.itemId ? byId(card.wish.itemId) : undefined;
      const t = item ? thumbs.get(item.id) : undefined;
      return <GladCard wish={card.wish} photo={t?.url} cut={t?.cut} colour={item ? pieceColour(item, trees.shades) : undefined} today={today} />;
    }
    case 'needsDetails':
      return (
        <button type="button" className="card card-row" onClick={() => go('/details')}>
          <Numeral value={card.count} className="card-num" />
          <span>{card.count === 1 ? 'piece needs details' : 'pieces need details'}</span>
          <span className="n m"><IconChev /></span>
        </button>
      );
    case 'onThisDay':
      return (
        <section className="card" aria-label="On this day">
          <p className="caps m">On this day</p>
          {card.list.slice(0, 4).map((x) => (
            <button key={`${x.what}-${x.item.id}`} type="button" className="li card-li" onClick={() => go('/piece', { id: x.item.id })}>
              <span>{x.what === 'bought' ? 'Bought' : 'Worn'} {yearsText(x.years)} ago: <b>{x.item.name}</b></span>
            </button>
          ))}
        </section>
      );
    case 'anniversary':
      return (
        <section className="card" aria-label="Anniversaries">
          {card.list.slice(0, 3).map((x) => (
            <button key={x.item.id} type="button" className="li card-li" onClick={() => go('/piece', { id: x.item.id })}>
              <span><b>{yearsText(x.years)}</b> with your {x.item.name} today</span>
            </button>
          ))}
        </section>
      );
    case 'recent':
      return (
        <section className="home-recent" aria-label="Recently added">
          <h2 className="caps m section-cap">Recently added</h2>
          <div className="grid">
            {card.items.map((i, n) => (
              <Tile key={i.id} item={i} photo={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut} colour={pieceColour(i, trees.shades)} index={n} onPress={() => go('/piece', { id: i.id })} />
            ))}
          </div>
        </section>
      );
    case 'year':
      return (
        <button type="button" className="card card-row year-card" onClick={() => go('/year')}>
          <span className="name" style={{ fontSize: 24 }}>Your {card.year} in review</span>
          <span className="n m"><IconChev /></span>
        </button>
      );
  }
}
