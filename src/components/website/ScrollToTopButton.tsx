'use client';

import { useEffect, useState } from 'react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed z-50 flex items-center justify-center border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] shadow-md transition-all duration-300 hover:bg-[var(--t-accent)] hover:border-[var(--t-accent)] hover:text-white ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{ bottom: '88px', right: '26px', width: '44px', height: '44px' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
        <path d="M8 12V4M4 8l4-4 4 4" />
      </svg>
    </button>
  );
}
