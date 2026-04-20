"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export default function TiltCard({ children, className = "", style = {}, delay = 0 }) {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  // Glare effect transforms
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareOpacity = useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.15]);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay: delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ...style,
        perspective: 1200,
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
      }}
      className={className}
    >
      <div style={{ 
        transform: "translateZ(40px)", 
        display: "flex", 
        flexDirection: "column", 
        height: "100%",
        position: "relative"
      }}>
        {children}
        
        {/* Dynamic Glare Overlay */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at var(--x) var(--y), rgba(255,255,255,0.3) 0%, transparent 60%)",
            opacity: isHovered ? 0.1 : 0,
            pointerEvents: "none",
            mixBlendMode: "overlay",
            zIndex: 10,
            transition: "opacity 0.3s ease",
            "--x": glareX,
            "--y": glareY,
          }}
        />
      </div>
    </motion.div>
  );
}

