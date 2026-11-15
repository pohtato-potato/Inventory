import type { CSSProperties, ReactNode } from 'react';
import { UNKNOWN_LIGHT, windowColour } from './light';

/** A dark window lit from behind by a pool of the piece's own colour, with a darker floor. */
export function Window({
  colour, lit = true, delay = 0, className = '', style, children, as: Tag = 'div', ...rest
}: {
  colour?: string;
  lit?: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  as?: 'div' | 'section' | 'button' | 'figure';
} & Record<string, unknown>) {
  const s = { '--c': windowColour(colour ?? UNKNOWN_LIGHT), '--d': `${delay}ms`, ...style } as CSSProperties;
  return (
    <Tag className={`win${lit ? '' : ' off'} ${className}`} style={s} {...rest}>
      {children}
    </Tag>
  );
}

/** A cut-out (or photo) standing in a window, with the faint rim light. */
export function Piece({ src, alt = '', className = '', style, cut = true }: { src?: string; alt?: string; className?: string; style?: CSSProperties; cut?: boolean }) {
  if (!src) return <span className="pc-empty" aria-hidden="true" />;
  return <img className={`pc${cut ? '' : ' uncut'} ${className}`} src={src} alt={alt} style={style} draggable={false} decoding="async" />;
}
