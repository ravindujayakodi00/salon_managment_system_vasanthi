'use client';

import { useEffect, useRef, useState } from 'react';

interface ScissorCutDividerProps {
  direction?: 'left' | 'right';
}

export default function ScissorCutDivider({ direction = 'right' }: ScissorCutDividerProps) {
  const [isVisible,    setIsVisible]    = useState(false);
  const [hasAnimated,  setHasAnimated]  = useState(false);
  const dividerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      }),
      { threshold: 0.5 }
    );
    if (dividerRef.current) observer.observe(dividerRef.current);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <div ref={dividerRef} className="overflow-hidden">
      <div
        className={`h-px bg-[var(--t-border)] transition-transform duration-1000 ease-out ${
          isVisible ? 'scale-x-100' : 'scale-x-0'
        }`}
        style={{ transformOrigin: direction === 'right' ? 'left' : 'right' }}
      />
    </div>
  );
}
