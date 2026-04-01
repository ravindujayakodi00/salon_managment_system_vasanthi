'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/utils/gsapConfig';
import { themeContent } from '@/themes';

const { services } = themeContent;

export default function ServicesSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sectionRef.current) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.service-row',
          { opacity: 0, y: 16 },
          {
            opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 75%',
              toggleActions: 'play none none none',
            },
          }
        );
      }, sectionRef);
      return () => ctx.revert();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="services"
      className="py-14 lg:py-20 bg-[var(--t-bg)] relative z-10"
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 lg:mb-12 gap-6">
          <div>
            <p className="t-script text-[var(--t-accent-2)]" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
              {services.label}
            </p>
          </div>
          <p className="text-[var(--t-text-2)] text-sm max-w-xs leading-relaxed">
            {services.subtext}
          </p>
        </div>

        {/* Accordion list */}
        <div className="border-t border-[var(--t-border)]">
          {services.items.map((service, i) => (
            <div
              key={i}
              className="service-row border-b border-[var(--t-border)] cursor-pointer"
              style={{ opacity: 1 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`flex items-center justify-between py-5 lg:py-6 transition-all duration-200 ${
                  hovered === i ? 'pl-4 lg:pl-6' : 'pl-0'
                }`}
              >
                {/* Number + Title */}
                <div className="flex items-center gap-5 lg:gap-10">
                  <span className="t-label text-[var(--t-text-3)] w-7 shrink-0">
                    {service.number}
                  </span>
                  <h3
                    className={`t-display font-light transition-colors duration-200 ${
                      hovered === i ? 'text-[var(--t-accent-2)]' : 'text-[var(--t-text)]'
                    }`}
                    style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                  >
                    {service.title}
                  </h3>
                </div>

                {/* Description + Arrow */}
                <div className="flex items-center gap-8">
                  <p
                    className={`text-[var(--t-text-2)] text-sm leading-relaxed max-w-[240px] transition-all duration-200 hidden lg:block ${
                      hovered === i ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {service.description}
                  </p>
                  <span
                    className={`text-sm transition-all duration-200 ${
                      hovered === i ? 'text-[var(--t-accent-2)] translate-x-1' : 'text-[var(--t-text-3)]'
                    }`}
                  >
                    →
                  </span>
                </div>
              </div>

              {/* Mobile description */}
              {hovered === i && (
                <p className="lg:hidden text-[var(--t-text-2)] text-sm leading-relaxed pb-4 pl-12">
                  {service.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Book CTA */}
        <div className="mt-8 lg:mt-12">
          <a href="/booking" className="t-btn t-btn-accent">
            Book a Service
          </a>
        </div>
      </div>
    </section>
  );
}
