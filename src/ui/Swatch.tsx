import type { CSSProperties, ReactNode } from 'react';
import { itemColour, tileColour, tintOf } from '../domain/colour';

/**
 * A surface in a thing's colour. `tile` is the darker ground a photo sits on in a grid; `page` is the colour itself,
 * clamped so chalk text reads on it. Sets --c (the colour) and --tint (quiet text on it) for what is inside.
 */
export function Swatch({
  colour, tone = 'tile', dim = false, delay = 0, className = '', style, children, as: Tag = 'div', ...rest
}: {
  colour?: string;
  tone?: 'tile' | 'page';
  dim?: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  as?: 'div' | 'section' | 'button' | 'figure' | 'span';
} & Record<string, unknown>) {
  const c = colour ?? '#59626D';
  const s = { '--c': tone === 'tile' ? tileColour(c) : itemColour(c), '--tint': tintOf(c), '--d': `${delay}ms`, ...style } as CSSProperties;
  return (
    <Tag className={`sw${dim ? ' dim' : ''} ${className}`} style={s} {...rest}>
      {children}
    </Tag>
  );
}

/** The CSS variables for a whole page in a thing's colour. */
export function pageColours(colour: string): CSSProperties {
  return { '--c': itemColour(colour), '--tint': tintOf(colour) } as CSSProperties;
}

/** A cut-out (or a photo as taken) standing on its colour. */
export function Cut({ src, alt = '', className = '', style, cut = true }: { src?: string; alt?: string; className?: string; style?: CSSProperties; cut?: boolean }) {
  if (!src) return null;
  return <img className={`pc${cut ? '' : ' uncut'} ${className}`} src={src} alt={alt} style={style} draggable={false} decoding="async" />;
}
