"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Cursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    // Disable custom cursor on mobile/touch devices
    if (window.matchMedia("(pointer: fine)").matches) {
      setIsMobile(false);
    }

    const updateMousePosition = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e) => {
      if (e.target.tagName.toLowerCase() === 'a' || 
          e.target.tagName.toLowerCase() === 'button' ||
          e.target.tagName.toLowerCase() === 'input' ||
          e.target.tagName.toLowerCase() === 'textarea' ||
          e.target.closest('a') || 
          e.target.closest('button') ||
          e.target.classList.contains('interactive')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    if (!isMobile) {
      window.addEventListener("mousemove", updateMousePosition);
      window.addEventListener("mouseover", handleMouseOver);
      
      // Force hide default cursor globally
      document.body.style.cursor = 'none';
      const interactiveElements = document.querySelectorAll('a, button, input, textarea');
      interactiveElements.forEach(el => el.style.cursor = 'none');
    }

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      window.removeEventListener("mouseover", handleMouseOver);
      document.body.style.cursor = 'auto';
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div style={{ pointerEvents: 'none', zIndex: 99999, position: 'fixed', inset: 0 }}>
      <motion.div
        className="custom-cursor-dot"
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4,
          scale: isHovering ? 0 : 1,
        }}
        transition={{ type: "tween", ease: "backOut", duration: 0.1 }}
      />
      <motion.div
        className="custom-cursor-ring"
        animate={{
          x: mousePosition.x - 20,
          y: mousePosition.y - 20,
          scale: isHovering ? 1.5 : 1,
          backgroundColor: isHovering ? "rgba(0, 210, 182, 0.1)" : "transparent",
          borderColor: isHovering ? "rgba(0, 210, 182, 0.5)" : "rgba(255, 255, 255, 0.3)"
        }}
        transition={{ type: "tween", ease: "backOut", duration: 0.2 }}
      />
    </div>
  );
}
