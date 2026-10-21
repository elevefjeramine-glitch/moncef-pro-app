"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import MagneticButton from "@/components/motion/MagneticButton";

export interface CreativeButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Show the sliding arrow affordance. */
  arrow?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Bold CTA: animated gradient border, shine sweep on hover, sliding arrow,
 * 3D press-down physics, magnetic pull (fine pointers only, via MagneticButton).
 * Renders a real <a> (href) or <button> (onClick) — always keyboard-focusable.
 */
export default function CreativeButton({ children, href, onClick, arrow = true, className, ariaLabel }: CreativeButtonProps) {
  const inner = (
    <span className="creative-btn-inner">
      <span className="creative-btn-label">{children}</span>
      {arrow && (
        <span className="creative-btn-arrow" aria-hidden="true">
          <ArrowRight size={18} />
        </span>
      )}
    </span>
  );

  const frame = href ? (
    <a href={href} className={`creative-btn${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={`creative-btn${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {inner}
    </button>
  );

  return <MagneticButton>{frame}</MagneticButton>;
}
