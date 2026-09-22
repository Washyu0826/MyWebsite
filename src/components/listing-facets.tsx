import type { CSSProperties } from 'react';
import { buildPlate, PLATE_H, PLATE_W, type Plate } from '@/lib/facet-plate';

/**
 * The cubist plates that stand in the gutters of the listing pages.
 *
 * Projects and Notes are a narrow column of wide rows with a lot of room left over on both sides,
 * and the room was doing nothing. Each gutter now holds a tall plate built the way the hero's
 * backdrop is - a rectangle cut into interlocking facets, construction lines running past the
 * shapes they describe, arcs, hatching - drawn once on the server as SVG rather than painted on a
 * canvas, because two of those would double the most expensive thing the site does per frame.
 *
 * Four things move, all of them free: three depth layers slide past each other with the scroll on a
 * view timeline, each facet breathes on its own long cycle, the construction lines draw themselves
 * in and out, and a soft band of light crosses each plate once a minute. Under
 * `prefers-reduced-motion` the whole composition still renders, completely still.
 *
 * The geometry is computed once per process from fixed seeds, so the server and the client agree
 * and every visitor sees the same drawing.
 */
const PLATES: Record<Side, Plate> = { left: buildPlate(4211), right: buildPlate(9137) };
const LAYERS = [0, 1, 2] as const;
type Side = 'left' | 'right';

function FacetPlate({ side }: { side: Side }) {
  const plate = PLATES[side];
  const id = `plate-${side}`;
  return (
    <svg
      className={`listing-plate listing-plate-${side}`}
      viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Hatching, at one of the composition's own angles rather than a neutral 45. */}
        <pattern id={`${id}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--plate-line)" strokeWidth="1" strokeOpacity="0.42" />
        </pattern>
        {/* The band of light: a soft edge on both sides so it has no boundary of its own. */}
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="var(--plate-sweep)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--plate-sweep)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--plate-sweep)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {LAYERS.map(layer => (
        <g key={layer} className="plate-layer" data-layer={layer}>
          {plate.facets
            .filter(facet => facet.layer === layer)
            .map((facet, i) => (
              <g
                key={`f${i}`}
                className="plate-facet"
                style={
                  {
                    '--sway': `${facet.sway}s`,
                    '--lag': `${facet.lag}s`,
                    '--sx': `${facet.shift[0]}px`,
                    '--sy': `${facet.shift[1]}px`,
                  } as CSSProperties
                }
              >
                <path d={facet.d} fill={`var(--plate-${facet.pigment})`} fillOpacity={facet.alpha} />
                {facet.hatch ? <path d={facet.d} fill={`url(#${id}-hatch)`} fillOpacity="0.38" /> : null}
                <path d={facet.d} className="plate-edge" fill="none" />
              </g>
            ))}
          {plate.arcs
            .filter(arc => arc.layer === layer)
            .map((arc, i) => (
              <path key={`a${i}`} d={arc.d} className="plate-arc" fill="none" strokeOpacity={arc.alpha} />
            ))}
          {plate.lines
            .filter(line => line.layer === layer)
            .map((line, i) => (
              <path
                key={`l${i}`}
                d={line.d}
                className="plate-line"
                fill="none"
                style={
                  {
                    '--len': `${line.length}px`,
                    '--period': `${line.period}s`,
                    '--lag': `${line.lag}s`,
                  } as CSSProperties
                }
              />
            ))}
        </g>
      ))}
      <g className="plate-sweep">
        <rect x="-20" y={-PLATE_H * 0.55} width={PLATE_W + 40} height={PLATE_H * 0.55} fill={`url(#${id}-sweep)`} />
      </g>
    </svg>
  );
}

/** Sits inside `.listing-page`, which is the positioned box the two gutters are measured from. */
export function ListingFacets() {
  return (
    <div className="listing-facets" aria-hidden="true">
      <FacetPlate side="left" />
      <FacetPlate side="right" />
    </div>
  );
}
