'use client';

import { useEffect, useRef, useState } from 'react';
import { themeContent } from '@/themes';

const { testimonials } = themeContent;

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [animKey,   setAnimKey]   = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setIsVisible(true); }),
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx(i => (i + 1) % testimonials.items.length);
      setAnimKey(k => k + 1);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  const goTo = (i: number) => { setActiveIdx(i); setAnimKey(k => k + 1); };
  const active = testimonials.items[activeIdx];

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="py-14 lg:py-20 bg-[var(--t-bg)] relative z-10"
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">

        {/* Label */}
        <p className="t-script text-[var(--t-accent-2)] mb-8 lg:mb-10" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
          {testimonials.label}
        </p>

        <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Large italic quote */}
          <blockquote
            key={animKey}
            className="t-display font-light italic text-[var(--t-text)] leading-[1.15] max-w-4xl mb-12 lg:mb-16 animate-fade-in"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 2rem)', minHeight: '5rem' }}
          >
            &ldquo;{active.quote}&rdquo;
          </blockquote>

          {/* Author + indicator */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[var(--t-text)] text-sm font-medium tracking-wide">
                {active.name}
              </p>
              <p className="t-label text-[var(--t-accent-2)] mt-1 tracking-[0.3em]">
                {active.service}
              </p>
            </div>

            {/* Line indicators */}
            <div className="flex items-center gap-3">
              {testimonials.items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Testimonial ${i + 1}`}
                  className={`h-px transition-all duration-300 ${
                    i === activeIdx
                      ? 'w-10 bg-[var(--t-accent)]'
                      : 'w-5 bg-[var(--t-border-2)] hover:bg-[var(--t-text-3)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
