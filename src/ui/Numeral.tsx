import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { rollFrames } from './light';

/** A condensed numeral that rolls up from zero when it first appears and when it changes. */
export function Numeral({ value, roll = true, className = '', style }: { value: number; roll?: boolean; className?: string; style?: CSSProperties }) {
  const [shown, setShown] = useState(roll ? 0 : value);
  const from = useRef(roll ? 0 : value);
  useEffect(() => {
    if (!roll) {
      setShown(value);
      return;
    }
    const start = from.current;
    const frames = rollFrames(Math.max(0, value - start), 40).map((f) => start + f);
    if (value < start) {
      setShown(value);
      from.current = value;
      return;
    }
    let i = 0, raf = 0;
    const tick = () => {
      setShown(frames[i]);
      i++;
      if (i < frames.length) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, roll]);
  return (
    <span className={`num ${className}`} style={style} aria-label={String(value)}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
