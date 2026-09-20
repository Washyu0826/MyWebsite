// A still fragment of the homepage composition for the 404 and error pages: the same analytic-cubist
// language as components/cubist-backdrop.tsx — a plate opened by straight cuts, one hatched facet, the
// construction lines and one arc left visible — but hand-placed, drawn once, and never animated.
// Decorative only, so it is hidden from assistive technology and carries no copy.
const FACETS: [string, string, number][] = [
  ['8,8 96,8 172,90 8,132', 'var(--ink)', 0.04],
  ['96,8 232,8 232,74 172,90', 'var(--indigo)', 0.1],
  ['8,132 120,103 150,188 8,206', 'var(--ink)', 0.07],
  ['120,103 232,74 232,178 150,188', 'var(--indigo)', 0.05],
  ['8,206 72,198 112,280 8,280', 'var(--ink)', 0.11],
  ['72,198 232,178 232,280 112,280', 'var(--ink)', 0.03],
];
const HATCH = Array.from({ length: 13 }, (_, i) => 88 + i * 11);
export function CubistFigure() {
  return <svg className="cubist-figure" viewBox="0 0 240 288" fill="none" aria-hidden="true" focusable="false">
    <clipPath id="cubist-figure-hatch"><polygon points="8,132 120,103 150,188 8,206" /></clipPath>
    {FACETS.map(([points, fill, opacity]) => <polygon key={points} points={points} fill={fill} fillOpacity={opacity} />)}
    <g clipPath="url(#cubist-figure-hatch)" stroke="currentColor" strokeWidth="0.75" opacity="0.32">
      {HATCH.map(y => <line key={y} x1="-40" y1={y} x2="200" y2={y - 90} />)}
    </g>
    {FACETS.map(([points]) => <polygon key={points} points={points} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />)}
    {/* Construction: the cut lines carried past the plate, and the arc that set the right-hand facets. */}
    <g stroke="currentColor" strokeOpacity="0.34" strokeWidth="0.9">
      <line x1="0" y1="134" x2="240" y2="72" />
      <line x1="196" y1="0" x2="58" y2="288" />
      <path d="M90 170A92 92 0 0 1 216 44" strokeWidth="1.1" />
    </g>
  </svg>;
}
