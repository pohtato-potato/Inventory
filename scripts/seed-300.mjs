// Dev only. Seeding needs the browser's database, so this prints the address that does it:
// open it on the running dev server (npm run dev) with an empty database and 300 sample pieces are added.
// Never shipped: the seeding code (src/dev/sample.ts) is imported only in development builds.
const n = Number(process.argv[2] ?? 300);
console.log(`Open http://localhost:5174/#/wardrobe?devseed=${n} on an empty dev database (Settings in Chrome > clear site data first).`);
