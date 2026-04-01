'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { themeContent } from '@/themes';
import logoLongLight from '@/assets/logo-pack/logo-long-light.png';

interface NavbarProps {
  alwaysVisible?: boolean;
}

const navLinks = [
  { name: 'Home',         href: '#home'         },
  { name: 'Services',     href: '#services'     },
  { name: 'Gallery',      href: '#gallery'      },
  { name: 'Testimonials', href: '#testimonials' },
  { name: 'Contact',      href: '#contact'      },
];

export default function Navbar({ alwaysVisible = false }: NavbarProps) {
  const [isScrolled,       setIsScrolled]       = useState(false);
  const [isVisible,        setIsVisible]        = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 50);
      setIsVisible(true);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (window.scrollY > 120 && !alwaysVisible) {
        scrollTimeout.current = setTimeout(() => setIsVisible(false), 2500);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [alwaysVisible]);

  const shouldHide = !alwaysVisible && !isVisible && !isMobileMenuOpen;

  // When over hero (transparent): white text. When scrolled / alwaysVisible: dark text.
  const onHero = !isScrolled && !alwaysVisible && !isMobileMenuOpen;

  return (
    <>
      {/* ── MAIN NAVBAR ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled || alwaysVisible || isMobileMenuOpen
            ? 'bg-[var(--t-bg)] border-b border-[var(--t-border)] shadow-[0_1px_0_var(--t-border)]'
            : 'bg-transparent'
        } ${shouldHide ? '-translate-y-full' : 'translate-y-0'}`}
        onMouseEnter={() => setIsVisible(true)}
      >
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
          <div className={`relative flex items-center justify-between transition-all duration-300 ${
            isScrolled || alwaysVisible ? 'py-6 lg:py-4' : 'py-6 lg:py-6'
          }`}>

            {/* Logo — centered on mobile, left-aligned on desktop */}
            <a href="#home" className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex-shrink-0">
              <Image
                src={logoLongLight}
                alt={themeContent.salonName}
                height={42}
                className="w-auto transition-all duration-300"
                priority
              />
            </a>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-9">
              {navLinks.map(link => (
                <a
                  key={link.name}
                  href={link.href}
                  className={`t-nav-link transition-colors duration-200 ${
                    onHero
                      ? 'text-white/80 hover:text-white'
                      : 'text-[var(--t-text-2)] hover:text-[var(--t-text)]'
                  }`}
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Right: Book Now */}
            <div className="hidden lg:flex items-center gap-3">
              <Link href="/booking" className="t-btn t-btn-accent">
                Book Now
              </Link>
            </div>

            {/* Hamburger */}
            <button
              className={`lg:hidden p-1 transition-colors ${
                onHero ? 'text-white' : 'text-[var(--t-text)]'
              }`}
              onClick={() => setIsMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      <div
        className={`fixed inset-0 z-40 bg-[var(--t-bg)] flex flex-col transition-all duration-500 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="h-16" />

        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          {navLinks.map((link, i) => (
            <a
              key={link.name}
              href={link.href}
              className="t-display text-4xl font-light italic tracking-[0.06em] text-[var(--t-text)] hover:text-[var(--t-accent-2)] transition-colors duration-200"
              style={{ transitionDelay: `${i * 40}ms` }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-[200px]">
            <Link
              href="/booking"
              className="t-btn t-btn-accent w-full text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Book Now
            </Link>
            <Link
              href="/booking"
              className="t-btn t-btn-outline w-full text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Appointments
            </Link>
          </div>
        </div>

        <div className="border-t border-[var(--t-border)] p-6 text-center">
          <p className="t-label text-[var(--t-text-3)] text-[0.58rem]">
            {themeContent.salonName} &mdash; {themeContent.tagline}
          </p>
        </div>
      </div>
    </>
  );
}
