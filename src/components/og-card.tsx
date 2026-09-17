// Shared layout for the Open Graph images. Rendered by Satori (next/og), so only flexbox and inline styles are used
// and only the bundled default font is relied on; no font fetching at build time.
import { BRAND_DOT, BRAND_HOOK, BRAND_VIEWBOX } from './brand-mark';
export const OG_SIZE = { width: 1200, height: 630 };
const palette = { paper: '#0D0E10', ink: '#F5F5F2', graphite: '#A7A9AD', indigo: '#C8B06A', rule: '#2B2D31' };
export function OgCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }) {
  const long = title.length > 48;
  return <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: 72, background: palette.paper, color: palette.ink, fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: palette.indigo, fontSize: 28, letterSpacing: 1 }}>
      <svg viewBox={BRAND_VIEWBOX} width={40} height={52}>
        <path d={BRAND_HOOK} fill="none" stroke={palette.indigo} strokeWidth={210} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={BRAND_DOT.x} y={BRAND_DOT.y} width={BRAND_DOT.width} height={BRAND_DOT.height} rx={BRAND_DOT.rx} transform={BRAND_DOT.rotate} fill={palette.indigo} />
      </svg>
      <span>{eyebrow}</span>
    </div>
    <div style={{ display: 'flex', fontSize: long ? 56 : 72, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000,
      overflow: 'hidden', textOverflow: 'ellipsis' }}>{title.slice(0, 110)}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${palette.rule}`, paddingTop: 28,
      color: palette.graphite, fontSize: 26 }}>
      <span>{footer ?? ''}</span>
    </div>
  </div>;
}
