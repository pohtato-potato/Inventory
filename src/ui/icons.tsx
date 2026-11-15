import type { ReactNode } from 'react';

const Svg = ({ d, size = 22 }: { d: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const IconSearch = ({ size }: { size?: number }) => <Svg size={size} d={<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>} />;
export const IconBack = ({ size = 20 }: { size?: number }) => <Svg size={size} d={<path d="M15 6l-6 6 6 6" />} />;
export const IconChev = ({ size = 18 }: { size?: number }) => <Svg size={size} d={<path d="M9 6l6 6-6 6" />} />;
export const IconDown = ({ size = 18 }: { size?: number }) => <Svg size={size} d={<path d="M6 9l6 6 6-6" />} />;
export const IconPin = ({ size = 18 }: { size?: number }) => <Svg size={size} d={<><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>} />;
export const IconCheck = ({ size = 16 }: { size?: number }) => <Svg size={size} d={<path d="M5 12l5 5 9-10" />} />;
export const IconMenu = ({ size = 22 }: { size?: number }) => <Svg size={size} d={<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>} />;
export const IconClose = ({ size = 20 }: { size?: number }) => <Svg size={size} d={<path d="M6 6l12 12M18 6L6 18" />} />;
export const IconPlus = ({ size = 22 }: { size?: number }) => <Svg size={size} d={<path d="M12 5v14M5 12h14" />} />;
export const IconImage = ({ size = 22 }: { size?: number }) => <Svg size={size} d={<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>} />;
export const IconCalendar = ({ size = 22 }: { size?: number }) => <Svg size={size} d={<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>} />;
