"use client";

import React, { useRef, useState, CSSProperties, ReactNode } from "react";
import { useSpring, animated, to } from "@react-spring/web";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}

export default function TiltCard({ children, className, style, delay = 0 }: TiltCardProps) {
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
      style={{
        ...style,
        perspective: 1200,
        transformStyle: "preserve-3d",
        transform: to(
          [x, y],
          (xVal, yVal) => `rotateX(${yVal * -20}deg) rotateY(${xVal * 20}deg)`
        ),
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
