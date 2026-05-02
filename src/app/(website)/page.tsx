'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/website/Navbar';
import HeroSection from '@/components/website/HeroSection';
import ServicesSection from '@/components/website/ServicesSection';
import GallerySection from '@/components/website/GallerySection';
import TestimonialsSection from '@/components/website/TestimonialsSection';
import MapContactSection from '@/components/website/MapContactSection';
import Footer from '@/components/website/Footer';
import VideoScroller from '@/components/website/VideoScroller';
import ScissorCutDivider from '@/components/website/ScissorCutDivider';
import BookingCTA from '@/components/website/BookingCTA';
import Preloader from '@/components/website/Preloader';

export default function Home() {
  // Start false on both server and client to avoid hydration mismatch.
  // useEffect (client-only) decides whether to show the preloader after mount.
  const [isLoading, setIsLoading]     = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Return visit: skip preloader, show content immediately
    if (sessionStorage.getItem('vgs_preloader_seen') === '1') {
      setShowContent(true);
      return;
    }
    // First visit: show preloader
    setIsLoading(true);
  }, []);

  // When preloader finishes (isLoading goes false after being true), show content
  const [preloaderRan, setPreloaderRan] = useState(false);
  useEffect(() => {
    if (isLoading) { setPreloaderRan(true); return; }
    if (!preloaderRan) return; // isLoading was never true, return visit handled above
    sessionStorage.setItem('vgs_preloader_seen', '1');
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, [isLoading, preloaderRan]);

  return (
    <>
      {isLoading && <Preloader onComplete={() => setIsLoading(false)} />}

      {/* Background prevents flash */}
      <div className="fixed inset-0 bg-[var(--t-bg)] -z-20" />

      <main
        className={`relative min-h-screen overflow-x-hidden transition-opacity duration-700 ease-out ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      >
        {/* Scroll-controlled video background */}
        <VideoScroller />

        <Navbar />
        <HeroSection />

        <ScissorCutDivider direction="right" />
        <ServicesSection />

        <ScissorCutDivider direction="left" />
        <GallerySection />

        <ScissorCutDivider direction="right" />
        <TestimonialsSection />

        <ScissorCutDivider direction="left" />
        <BookingCTA />

        <ScissorCutDivider direction="right" />
        <MapContactSection />

        <Footer />
      </main>
    </>
  );
}
