import Link from 'next/link';
import Image from 'next/image';
import { FaInstagram, FaFacebookF, FaWhatsapp } from 'react-icons/fa';
import { themeContent } from '@/themes';
import logoFooter from '@/assets/logo-pack/final one-08.png';
import {JSX} from "react";

const socialIcons: Record<string, JSX.Element> = {
  Instagram: <FaInstagram size={16} />,
  Facebook:  <FaFacebookF size={15} />,
  WhatsApp:  <FaWhatsapp size={16} />,
};

const { salonName, tagline, footer } = themeContent;

export default function Footer() {
  return (
    <footer className="bg-[var(--t-bg-dark)] relative z-10">

      {/* Marquee strip */}
      <div className="border-b border-white/10 py-4 overflow-hidden">
        <div className="marquee-track whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="t-label text-white/30 px-8 tracking-[0.4em]">
              {salonName}&nbsp;&nbsp;·&nbsp;&nbsp;{tagline}
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-10 lg:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Image
              src={logoFooter}
              alt={salonName}
              height={52}
              className="w-auto mb-4"
            />
            <p className="text-white/40 text-sm leading-relaxed max-w-[200px]">
              {footer.tagline}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="t-label text-white/30 mb-5 tracking-[0.35em]">Navigation</p>
            <ul className="space-y-3">
              {footer.links.map(link => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-white/50 hover:text-[var(--t-accent)] transition-colors duration-200 text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Book */}
          <div>
            <p className="t-label text-white/30 mb-5 tracking-[0.35em]">Appointment</p>
            <Link href="/booking" className="t-btn t-btn-accent inline-block">
              Book Now
            </Link>
          </div>

          {/* Social */}
          <div>
            <p className="t-label text-white/30 mb-5 tracking-[0.35em]">Follow Us</p>
            <div className="flex gap-3">
              {footer.socials.map(s => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="w-9 h-9 border border-white/15 flex items-center justify-center text-white/40 hover:text-[var(--t-accent)] hover:border-[var(--t-accent)] transition-all duration-200"
                >
                  {socialIcons[s.name]}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="t-label text-white/25 text-[0.58rem] tracking-[0.25em]">
            © {new Date().getFullYear()} {salonName}. All rights reserved.
          </p>
          <p className="t-label text-white/25 text-[0.58rem] tracking-[0.25em]">
            Powered by SalonFlow
          </p>
        </div>
      </div>
    </footer>
  );
}
