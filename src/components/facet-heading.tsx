/**
 * A section heading cut into diagonal facets that slide into place as the page scrolls it up. The
 * text is repeated once per facet and each copy is clipped to its own slice; the first copy stays in
 * flow so the heading keeps its normal size, the rest sit on top of it. Screen readers get the plain
 * string once. Pure markup: facets.css owns the motion and its fallbacks.
 */
const FACETS = 7;

export function FacetHeading({ text, id, as: Tag = 'h2', className }: {
  text: string;
  id?: string;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return <Tag id={id} className={['facet-heading', className].filter(Boolean).join(' ')}>
    <span className="sr-only">{text}</span>
    <span className="facet-stack" aria-hidden="true" style={{ '--facets': FACETS } as React.CSSProperties}>
      {Array.from({ length: FACETS }, (_, index) => <span key={index} className="facet" style={{ '--i': index } as React.CSSProperties}>{text}</span>)}
    </span>
  </Tag>;
}
