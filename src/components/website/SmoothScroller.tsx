'use client';

import { useLayoutEffect } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '@/utils/gsapConfig';

export default function SmoothScroller() {
    useLayoutEffect(() => {
        // Skip Lenis on mobile — native scroll is smooth enough and Lenis
        // intercepts touch events causing horizontal drag on mobile browsers
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
        });

        // Store lenis on window for global access if needed
        (window as any).lenis = lenis;

        // Synchronize Lenis with GSAP ScrollTrigger
        lenis.on('scroll', () => {
            ScrollTrigger.update();
        });

        // Add Lenis to GSAP ticker for smooth animation synchronization
        const rafCallback = (time: number) => {
            lenis.raf(time * 1000);
        };
        gsap.ticker.add(rafCallback);

        // Disable GSAP lag smoothing to prevent jumps
        gsap.ticker.lagSmoothing(0);

        // Refresh ScrollTrigger after everything is set up
        setTimeout(() => {
            ScrollTrigger.refresh();
        }, 100);

        return () => {
            lenis.destroy();
            gsap.ticker.remove(rafCallback);
        };
    }, []);

    return null;
}
