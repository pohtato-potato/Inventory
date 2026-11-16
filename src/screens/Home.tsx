import { logWear, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfits, useToday, useTrees, useWears, useWishes } from '../db/hooks';
import { homeCards, type Card } from '../domain/home';
import { layout, lightPiece } from '../domain/outfit';
import type { Item, Outfit, Wear } from '../domain/types';
import { dayStart, suggestWords } from '../domain/wearlog';
import { wearLine } from '../domain/wears';
import { go } from '../router';
import { Numeral } from '../ui/Numeral';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { Window } from '../ui/Window';
import { IconChev } from '../ui/icons';
import { Mini, pieceColour, type Thumb, type Trees } from './shared';
import { GladCard } from './Wishes';

const agoText = (n: number) => (n === 1 ? 'a year ago' : `${n} years ago`);
const yearsText = (n: number) => (n === 1 ? 'a year' : `${n} years`);
const owned = (i: Item | undefined) => !!i && i.status === 'owned' && i.deletedAt === undefined;

/** Home: the date in a lit window, then the day's cards. The app still opens on the wardrobe; Home is a tab. */
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
  // The header is lit by today's outfit (logged, else suggested): its top's colour.
  const log = cards[0].type === 'log' ? cards[0] : undefined;
  const todayIds = (log?.logged?.itemIds ?? log?.suggestion?.itemIds ?? []).filter((id) => owned(live.find((i) => i.id === id)));
  const todayItems = todayIds.map((id) => live.find((i) => i.id === id)!);
  const litId = lightPiece(layout(todayItems, trees.kinds, new Map()));
  const lit = live.find((i) => i.id === litId);

  return (
    <main className="screen home">
      <Window as="section" className="home-hero" colour={lit ? pieceColour(lit, trees.shades) : undefined} lit aria-label="Today">
        <div className="top">
          <h1 className="caps">Home</h1>
          <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => go('/numbers')}>Numbers</button>
        </div>
        <div className="home-date">
          <Numeral value={date.getDate()} className="home-num" />
          <p className="caps m">{date.toLocaleDateString('en-GB', { weekday: 'long' })}<br />{date.toLocaleDateString('en-GB', { month: 'long' })}</p>
        </div>
      </Window>
      {cards.map((c) => <HomeCard key={c.type} card={c} items={live} wears={wears} outfits={outfits} trees={trees} thumbs={thumbs} today={today} />)}
    </main>
  );
}

function HomeCard({ card, items, wears, outfits, trees, thumbs, today }: { card: Card; items: Item[]; wears: Wear[]; outfits: Outfit[]; trees: Trees; thumbs: Map<string, Thumb>; today: string }) {
  const byId = (id: string) => items.find((i) => i.id === id);
  switch (card.type) {
    case 'log': {
      if (card.logged) {
        return (
          <section className="card home-log" aria-label="Today">
            <p className="name home-q">What you wore today</p>
            <div className="mini-row">{card.logged.itemIds.map((id) => byId(id)).filter((i) => !!i).map((i) => <Mini key={i.id} item={i} thumb={thumbs.get(i.id)} shades={trees.shades} size={53} />)}</div>
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
                {ids.map((id) => <Mini key={id} item={byId(id)!} thumb={thumbs.get(id)} shades={trees.shades} size={53} />)}
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
      return <GladCard wish={card.wish} photo={t?.url} cut={t?.cut} colour={item ? pieceColour(item, trees.shades) : undefined} today={today} />;
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
        <section aria-label="On this day">
          {card.list.slice(0, 4).map((x) => (
            <button key={`${x.what}-${x.item.id}`} type="button" className="li home-li" onClick={() => go('/piece', { id: x.item.id })}>
              <Mini item={x.item} thumb={thumbs.get(x.item.id)} shades={trees.shades} size={41} />
              <span>{x.what === 'bought' ? 'Bought' : 'Worn'} {agoText(x.years)} today: <b>{x.item.name}</b></span>
            </button>
          ))}
        </section>
      );
    case 'anniversary':
      return (
        <section aria-label="Anniversaries">
          {card.list.slice(0, 3).map((x) => (
            <button key={x.item.id} type="button" className="li home-li" onClick={() => go('/piece', { id: x.item.id })}>
              <Mini item={x.item} thumb={thumbs.get(x.item.id)} shades={trees.shades} size={41} />
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
        <button type="button" className="li home-li" onClick={() => go('/year')}>
          <span className="name" style={{ fontSize: 22 }}>Your {card.year} in review</span>
          <span className="n"><IconChev /></span>
        </button>
      );
  }
}
