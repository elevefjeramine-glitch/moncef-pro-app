"use client";

export interface MarqueeProps {
  items: string[];
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
}

/**
 * Infinite marquee band. Content is duplicated once and translated -50% for a
 * seamless loop. Pure CSS — pauses under prefers-reduced-motion.
 */
export default function Marquee({ items, className, speed = 30 }: MarqueeProps) {
  const row = (ariaHidden: boolean) => (
    <div className="marquee-row" aria-hidden={ariaHidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="marquee-item">
          <span className="marquee-dot" aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className={`marquee${className ? ` ${className}` : ""}`} role="presentation">
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
