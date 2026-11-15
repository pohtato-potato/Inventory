import { useRoute } from './router';

export function App() {
  const { path } = useRoute();
  return (
    <main className="screen">
      <p className="caps" style={{ padding: 16 }}>{path.slice(1)}</p>
      <nav aria-label="Tabs" />
    </main>
  );
}
