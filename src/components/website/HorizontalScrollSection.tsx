'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap, ScrollTrigger } from '@/utils/gsapConfig';
import Image from 'next/image';
import { themeContent } from '@/themes';

const { expertise } = themeContent;

export default function HorizontalScrollSection() {
  const sectionRef   = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted || !sectionRef.current || !containerRef.current) return;

    const timer = setTimeout(() => {
      const section   = sectionRef.current;
      const container = containerRef.current;
      if (!section || !container) return;

      const totalWidth    = container.scrollWidth;
      const viewportWidth = window.innerWidth;
      const scrollDistance = totalWidth - viewportWidth;

      const ctx = gsap.context(() => {
        gsap.to(container, {
          x: () => -scrollDistance,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${scrollDistance}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
      }, section);

      return () => ctx.revert();
    }, 300);

    return () => clearTimeout(timer);
  }, [isMounted]);

  return (
    <div
      ref={sectionRef}
      className="relative overflow-hidden z-10 bg-[var(--t-bg)]"
    >
      {/* Floating section label */}
      <div className="absolute top-8 left-6 lg:left-12 z-20 pointer-events-none">
        <p className="t-label text-[var(--t-accent)] mb-1">{expertise.heading}</p>
        <p className="t-label text-[var(--t-text-3)] text-[0.55rem]">{expertise.scrollHint} →</p>
      </div>

      {/* Horizontal container */}
      <div
        ref={containerRef}
        className="flex h-screen will-change-transform"
        style={{ width: `${expertise.items.length * 100}vw` }}
      >
        {expertise.items.map((item, index) => (
          <div
            key={item.id}
            className="w-screen h-screen flex items-center justify-center px-6 lg:px-16 flex-shrink-0"
          >
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center border border-[var(--t-border)] bg-[var(--t-bg-2)]">

              {/* Text side */}
              <div className="order-2 md:order-1 p-8 lg:p-12 space-y-5">
                {/* Number */}
                <div className="flex items-center gap-6">
                  <span className="t-label text-[var(--t-accent)] text-[0.6rem] tracking-[0.4em]">
                    {item.number}
                  </span>
                  <div className="h-px flex-1 bg-[var(--t-border)]" />
                </div>

                <h3
                  className="t-display font-light text-[var(--t-text)]"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}
                >
                  {item.title}
                </h3>

                <p className="text-[var(--t-text-2)] text-sm leading-relaxed max-w-xs">
                  {item.description}
                </p>

                <a href="/booking" className="t-btn t-btn-ghost inline-block">
                  Book This
                </a>
              </div>

              {/* Image side */}
              <div className="order-1 md:order-2 relative h-48 sm:h-64 md:h-80 lg:h-96 overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105 grayscale-[20%]"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                {/* Bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--t-bg-2)]/60 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {expertise.items.map((_, i) => (
          <div key={i} className="w-6 h-px bg-[var(--t-border-2)]" />
        ))}
      </div>
    </div>
  );
}
