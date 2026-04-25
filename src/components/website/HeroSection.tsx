'use client';

import { useEffect, useState } from 'react';
import { themeContent } from '@/themes';

const { hero } = themeContent;

export default function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden flex items-end"
      style={{ height: 'min(90vh, 800px)', minHeight: '540px' }}
    >
      {/* Dark gradient over video — hero always has dark bg for text legibility */}
      <div className="absolute inset-0 bg-black/45 z-[1]" />
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0) 100%)' }}
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)' }}
      />

      {/* ── CONTENT ── */}
      <div className="relative z-10 w-full max-w-screen-xl mx-auto px-6 lg:px-12 pb-14 lg:pb-20">
        <div
          className={`max-w-xl transition-all duration-1000 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Heading */}
          <h1
            className="t-display font-light leading-[1.0] text-white mb-6"
            style={{ fontSize: 'clamp(2.2rem, 5.5vw, 4.5rem)' }}
          >
            {hero.heading[0]}
            <br />
            <em className="t-script font-normal" style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5.2rem)' }}>
              {hero.heading[1]}
            </em>
          </h1>

          {/* Sub */}
          <p
            className={`text-white/70 text-sm max-w-sm leading-relaxed mb-8 transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {hero.subtext}
          </p>

          {/* CTAs */}
          <div
            className={`flex flex-wrap gap-3 transition-all duration-1000 delay-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <a href="/booking" className="t-btn t-btn-accent">
              {hero.ctaPrimary}
            </a>
            <a href="#services" className="t-btn t-btn-outline-white">
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-6 right-8 lg:right-12 z-10 flex flex-col items-center gap-2 transition-all duration-1000 delay-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span
          className="t-label text-white/40 text-[0.52rem] tracking-[0.3em]"
          style={{ writingMode: 'vertical-rl' }}
        >
          Scroll
        </span>
        <div className="w-px h-10 bg-white/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2/5 bg-[var(--t-accent)] animate-scroll-line" />
        </div>
      </div>
    </section>
  );
}
