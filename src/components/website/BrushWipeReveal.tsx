'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { gsap, ScrollTrigger } from '@/utils/gsapConfig';

interface BrushWipeRevealProps {
    children: ReactNode;
    direction?: 'left' | 'right' | 'up' | 'down';
}

export default function BrushWipeReveal({ children, direction = 'left' }: BrushWipeRevealProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const brushRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const isHorizontal = direction === 'left' || direction === 'right';
            const startPos = direction === 'left' || direction === 'up' ? '-100%' : '100%';
            const endPos = direction === 'left' || direction === 'up' ? '100%' : '-100%';

            // Create timeline for brush wipe effect
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 75%',
                    toggleActions: 'play none none reverse',
                }
            });

            // Brush swipe animation
            tl.fromTo(brushRef.current,
                {
                    [isHorizontal ? 'x' : 'y']: startPos,
                    opacity: 1,
                },
                {
                    [isHorizontal ? 'x' : 'y']: endPos,
                    duration: 1,
                    ease: 'power2.inOut',
                }
            );

            // Content reveal
            tl.fromTo(contentRef.current,
                {
                    clipPath: direction === 'left' ? 'inset(0 100% 0 0)' :
                        direction === 'right' ? 'inset(0 0 0 100%)' :
                            direction === 'up' ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)',
                    opacity: 0,
                },
                {
                    clipPath: 'inset(0 0 0 0)',
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power2.out',
                },
                '-=0.6'
            );
        }, containerRef);

        return () => ctx.revert();
    }, [direction]);

    return (
        <div ref={containerRef} className="relative overflow-hidden">
            {/* Brush element */}
            <div
                ref={brushRef}
                className="absolute inset-y-0 w-24 z-20 pointer-events-none"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(185, 165, 148, 0.4), rgba(143, 123, 108, 0.6), rgba(185, 165, 148, 0.4), transparent)',
                    filter: 'blur(8px)',
                }}
            />

            {/* Content */}
            <div ref={contentRef}>
                {children}
            </div>
        </div>
    );
}
