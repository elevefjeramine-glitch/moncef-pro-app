import { motion } from "framer-motion";

export function Skeleton({ className, style }) {
  return (
    <motion.div
      className={className}
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
        backgroundSize: '200% 100%',
        ...style
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 2, ease: "linear", repeat: Infinity }}
    />
  );
}
