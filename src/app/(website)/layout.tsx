import type { Metadata } from 'next';
import { Montserrat, Cormorant_Garamond, Pinyon_Script } from 'next/font/google';
import './website-globals.css';
import WebsiteProviders from '@/components/website/Providers';
import SmoothScroller from '@/components/website/SmoothScroller';
import WhatsAppButton from '@/components/website/WhatsAppButton';
import ScrollToTopButton from '@/components/website/ScrollToTopButton';
import { themeContent } from '@/themes';

const montserrat = Montserrat({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const pinyonScript = Pinyon_Script({
  variable: '--font-script',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${themeContent.salonName} — ${themeContent.tagline}`,
  description: themeContent.hero.subtext,
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${montserrat.variable} ${cormorant.variable} ${pinyonScript.variable} website-font-scope antialiased overflow-x-hidden`}
    >
      <WebsiteProviders>
        <SmoothScroller />
        {children}
        <WhatsAppButton />
        <ScrollToTopButton />
      </WebsiteProviders>
    </div>
  );
}
