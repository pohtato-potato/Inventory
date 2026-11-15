import { go } from '../router';

/** Home. Task 11 fills it with the day's cards; until then it points at the wear log. */
export function Home() {
  return (
    <main className="screen">
      <div className="top"><h1 className="caps">Home</h1></div>
      <p className="empty-line m">What did you wear today?</p>
      <div style={{ padding: '0 18px' }}><button type="button" className="acc" onClick={() => go('/wear')}>Log it</button></div>
    </main>
  );
}
