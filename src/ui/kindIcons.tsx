import type { CSSProperties } from 'react';
import type { KindGroup } from '../domain/kinds';

/** One line drawing per kind group, on a 24 grid: a tee, a laptop, a house, a hammer, a bag, a box. */
export const KIND_PATHS: Record<KindGroup, string> = {
  clothes: 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c0 1.7-1.3 3-4 3S8 4.7 8 3z',
  electronics: 'M5 5h14v10H5zM2 19h20',
  home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
  tools: 'M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8M4.5 16.5l3 3',
  bags: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  other: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
};

export function KindIcon({ group, size = 24, style }: { group: KindGroup; size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={KIND_PATHS[group]} />
    </svg>
  );
}

/** A faint repeating pattern of the kind's icon, for a thing with no photo. */
export function kindPattern(group: KindGroup): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='none' stroke='white' stroke-opacity='.13' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path transform='translate(6 6) scale(.75)' d='${KIND_PATHS[group]}'/><path transform='translate(34 34) scale(.75)' d='${KIND_PATHS[group]}'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** A big kind icon over its pattern: what a thing with no photo shows. */
export function NoPhoto({ group, size = 64 }: { group: KindGroup; size?: number }) {
  return (
    <span className="nophoto" style={{ backgroundImage: kindPattern(group) }} aria-hidden="true">
      <span className="nophoto-well"><KindIcon group={group} size={size} /></span>
    </span>
  );
}
