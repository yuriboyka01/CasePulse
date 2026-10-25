'use client';

import React, { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const from = previousValue.current;
    const startedAt = performance.now();
    const duration = 680;
    let frame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = (now: number) => {
      const progress = reducedMotion ? 1 : Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(from + (value - from) * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue.toLocaleString('en-IN')}</>;
}
