'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/website/Footer';
import AppointmentSection from '@/components/website/AppointmentSection';

export default function BookingPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <main className={`bg-[var(--t-bg)] ${isMobile ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
            {/* Subtle background texture */}
            <div className="fixed inset-0 -z-10 pointer-events-none">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top left, rgba(205,155,119,0.06) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(185,165,148,0.04) 0%, transparent 60%)' }} />
            </div>

            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-[var(--t-bg-3)] border border-[var(--t-border-2)] text-[var(--t-text-2)] hover:text-[var(--t-text)] hover:border-[var(--t-text)] transition-all shadow-sm"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="square" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="t-label text-[0.6rem]">Back</span>
            </button>

            {/* Booking Section */}
            <div className={`transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
                <AppointmentSection isStandalone={true} />
            </div>

            {/* Footer - Only show on desktop */}
            {!isMobile && <Footer />}
        </main>
    );
}
