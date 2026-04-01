'use client';

import { useEffect, useRef, useState } from 'react';
import { themeContent } from '@/themes';

const { contact } = themeContent;

export default function MapContactSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => setMapLoaded(true), 500);
        }
      }),
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const infoBlocks = [
    { label: 'Address', lines: contact.address },
    { label: 'Phone',   lines: contact.phones  },
    { label: 'Email',   lines: contact.emails  },
    { label: 'Hours',   lines: contact.hours   },
  ];

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="py-14 lg:py-20 bg-[var(--t-bg-2)] relative z-10"
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">

        {/* Header */}
        <div className={`mb-8 lg:mb-12 transition-all duration-800 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="t-script text-[var(--t-accent-2)]" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>{contact.label}</p>
        </div>

        {/* Map + info grid */}
        <div
          className={`grid lg:grid-cols-2 border border-[var(--t-border)] transition-all duration-1000 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Map */}
          <div className="relative min-h-[300px] lg:min-h-[480px] overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--t-border)]">
            {!mapLoaded && (
              <div className="absolute inset-0 bg-[var(--t-bg-3)] flex items-center justify-center">
                <div className="w-8 h-px bg-[var(--t-border-2)] animate-pulse" />
              </div>
            )}
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.8!2d79.8981334!3d6.8467948!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae25ba36e5a39dd%3A0x2b82e2728b5f11c2!2sVasanthi+Gulasekharam+Salon!5e0!3m2!1sen!2slk!4v1"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '300px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className={`transition-opacity duration-700 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Get Directions */}
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 t-btn t-btn-dark text-[0.6rem] px-4 py-2.5"
            >
              Get Directions
            </a>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 bg-[var(--t-bg-3)]">
            {infoBlocks.map((block, i) => (
              <div
                key={i}
                className={`p-7 lg:p-9 border-[var(--t-border)] ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b' : ''}`}
              >
                <p className="t-label text-[var(--t-accent-2)] mb-4 tracking-[0.35em]">
                  {block.label}
                </p>
                <div className="space-y-1">
                  {block.lines.map((line, j) => (
                    <p key={j} className="text-[var(--t-text-2)] text-sm leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
