import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

interface AnimatedCurrencyProps {
  value: number;
  className?: string;
}

export function AnimatedCurrency({ value, className }: AnimatedCurrencyProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latest)
  );

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: "easeOut"
    });
    return controls.stop;
  }, [value, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
