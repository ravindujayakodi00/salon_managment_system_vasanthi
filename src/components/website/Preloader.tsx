'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { themeContent } from '@/themes';
import logoSquare from '@/assets/logo-pack/logo-square.png';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExiting(true);
            setTimeout(onComplete, 700);
          }, 350);
          return 100;
        }
        return prev + 7;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onComplete]);

  if (!isMounted) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[var(--t-bg)] flex items-center justify-center">
        <Image src={logoSquare} alt={themeContent.salonName} width={160} height={160} className="w-auto" priority />
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[var(--t-bg)] flex items-center justify-center transition-opacity duration-700 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Corner marks */}
      <span className="absolute top-6 left-6 w-5 h-5 border-t border-l border-[var(--t-border-2)]" />
      <span className="absolute top-6 right-6 w-5 h-5 border-t border-r border-[var(--t-border-2)]" />
      <span className="absolute bottom-6 left-6 w-5 h-5 border-b border-l border-[var(--t-border-2)]" />
      <span className="absolute bottom-6 right-6 w-5 h-5 border-b border-r border-[var(--t-border-2)]" />

      <div className="flex flex-col items-center gap-10 w-full max-w-[280px] px-8">
        {/* Logo */}
        <Image
          src={logoSquare}
          alt={themeContent.salonName}
          width={160} height={160}
          className="w-auto"
          priority
        />

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-px bg-[var(--t-border-2)] w-full relative overflow-hidden">
            <div
              className="absolute top-0 left-0 h-px bg-[var(--t-accent)] transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="t-label text-[var(--t-text-3)] text-[0.58rem]">
              {progress < 100 ? 'Loading' : 'Welcome'}
            </span>
            <span className="t-label text-[var(--t-text-3)] text-[0.58rem]">
              {Math.min(progress, 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
