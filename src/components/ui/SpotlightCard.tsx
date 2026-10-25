'use client';

import React from 'react';

type SpotlightCardProps<T extends React.ElementType> = {
  /** Render as another element/component (e.g. next/link). Defaults to div. */
  as?: T;
  /** Very subtle pointer-driven 3D tilt (mouse only, off with reduced motion). */
  tilt?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'tilt' | 'className' | 'children'>;

const MAX_TILT_DEG = 2.4;

/**
 * Surface that follows the pointer with a soft brass glow and a luminous edge.
 * The effect is purely presentational â€” layout, semantics and focus behaviour
 * come from the element it renders as.
 */
export function SpotlightCard<T extends React.ElementType = 'div'>({
  as,
  tilt = false,
  className = '',
  children,
  ...rest
}: SpotlightCardProps<T>) {
  const Component = (as ?? 'div') as React.ElementType;

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);

    if (tilt && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const px = rect.width > 0 ? x / rect.width - 0.5 : 0;
      const py = rect.height > 0 ? y / rect.height - 0.5 : 0;
      el.style.setProperty('--rx', `${(px * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(-py * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLElement>) => {
    if (!tilt) return;
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  };

  return (
    <Component
      {...rest}
      className={`spotlight ${tilt ? 'spotlight-tilt' : ''} ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </Component>
  );
}
