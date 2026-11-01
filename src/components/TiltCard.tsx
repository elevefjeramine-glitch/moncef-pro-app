"use client";

import React, { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useSpring, animated, to } from "@react-spring/web";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  onClick?: () => void;
}

export default function TiltCard({ children, className, style, delay = 0, onClick }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const [{ x, y }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    config: { mass: 5, tension: 350, friction: 40 },
  }));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Values range from -0.5 to 0.5
    api.start({ x: mouseX / width - 0.5, y: mouseY / height - 0.5 });
  };

  const handleMouseEnter = () => setIsHovered(true);
  
  const handleMouseLeave = () => {
    api.start({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <animated.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...style,
        perspective: 1200,
        transformStyle: "preserve-3d",
        // Plafond 5° : x et y vont de -0.5 à 0.5, donc ×10 = ±5°.
        // (Avant : ×20, soit jusqu'à 10°, trop violent pour des cartes.)
        transform: to(
          [x, y],
          (xVal, yVal) => `rotateX(${yVal * -10}deg) rotateY(${xVal * 10}deg)`
        ),
        // Soulèvement au survol : ombre plus forte, sans toucher au transform
        // piloté par react-spring (un translateY CSS entrerait en conflit).
        boxShadow: isHovered
          ? "0 24px 48px rgba(89,130,255,0.18)"
          : style?.boxShadow,
      }}
      className={cn("relative overflow-hidden transition-shadow duration-300", className)}
    >
      <div 
        style={{ transform: "translateZ(40px)" }} 
        className="flex flex-col h-full relative"
      >
        {children}
        
        {/* Dynamic Glare Overlay */}
        <animated.div
          style={{
            position: "absolute",
            inset: 0,
            background: to(
              [x, y],
              (xVal, yVal) => `radial-gradient(circle at ${(xVal + 0.5) * 100}% ${(yVal + 0.5) * 100}%, rgba(255,255,255,0.3) 0%, transparent 60%)`
            ),
            opacity: isHovered ? 0.1 : 0,
            pointerEvents: "none",
            mixBlendMode: "overlay",
            zIndex: 10,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </animated.div>
  );
}
