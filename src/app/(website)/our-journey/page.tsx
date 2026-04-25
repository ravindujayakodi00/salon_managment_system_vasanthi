import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';

export const metadata: Metadata = {
  title: 'Our Journey — Vasanthi Gulasekharam Salon',
  description: 'Learn about the journey of Vasanthi Gulasekharam — a decade of expertise, world-class education, and a dedicated 1:1 beauty experience.',
};

export default function OurJourneyPage() {
  return (
    <>
      <Navbar alwaysVisible />

      <main className="bg-[var(--t-bg)] min-h-screen">

        {/* Page Hero */}
        <section className="pt-36 pb-16 lg:pt-44 lg:pb-20 bg-[var(--t-bg-dark)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <h1
              className="t-display font-light text-white leading-[1.1] mb-4"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}
            >
              Professional Care.<br />Personal Attention.
            </h1>
            <p className="t-script text-[var(--t-accent)] mt-2" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>
              The Journey of Vasanthi Gulasekharam
            </p>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-[var(--t-border)]" />

        {/* A Legacy of Expertise */}
        <section className="py-16 lg:py-24">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-2xl">
              <h2
                className="t-display font-light text-[var(--t-text)] mb-8"
                style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}
              >
                A Legacy of Expertise
              </h2>
              <div className="space-y-5 text-[var(--t-text-2)] text-sm leading-relaxed">
                <p className="italic text-[var(--t-text)] text-base">
                  True beauty is never a standard solution; it is a personal dialogue between the artist and the client.
                </p>
                <p>
                  With over a decade of experience in the beauty industry, Vasanthi Gulasekharam is a skilled and passionate professional dedicated to the art of transformation. Her journey is built on a foundation of world-class education, having honed her skills at prestigious institutions including the <strong className="text-[var(--t-text)] font-medium">Ramani Fernando Academy</strong> and <strong className="text-[var(--t-text)] font-medium">Roots Academy Bambalapitiya</strong>.
                </p>
                <p>
                  Holding Diplomas in both Hairdressing and Advanced Beauty Therapy, along with NVQ Level 4 certifications in both disciplines and an NVQ Level 3 in Nail Technology, Vasanthi&apos;s mastery is backed by rigorous technical excellence.
                </p>
                <p>
                  For the past seven years, Vasanthi has successfully managed her own beauty business, bringing a wealth of practical knowledge and a keen eye for detail to every interaction.
                </p>
                <p>
                  By moving away from the hurried pace of mass-market salons, she has created a <strong className="text-[var(--t-text)] font-medium">Private Space for Beauty</strong> — a dedicated 1:1 boutique where the noise of the outside world fades away, leaving room for focused, uninterrupted sessions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-[var(--t-border)] max-w-screen-xl mx-auto" />

        {/* Our Commitment */}
        <section className="py-16 lg:py-24 bg-[var(--t-bg-2)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-2xl">
              <h2
                className="t-display font-light text-[var(--t-text)] mb-8"
                style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}
              >
                Our Commitment
              </h2>
              <div className="space-y-5 text-[var(--t-text-2)] text-sm leading-relaxed">
                <p>
                  At Vasanthi Gulasekharam Salons, you are not just an appointment; you are our main guest. We provide undivided attention, ensuring that every snip, every shade, and every skin treatment is curated specifically for your features, your lifestyle, and your vision.
                </p>
                <p>
                  We believe that every client deserves a personalized experience. From our clinical standards of hygiene to the personalized nature of our consultations, every element of our salon is designed for the discerning individual who seeks excellence in a space that feels like home and for those who seek more than just a salon visit.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Vision */}
        <section className="py-16 lg:py-24">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-2xl">
              <h2
                className="t-display font-light text-[var(--t-text)] mb-8"
                style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}
              >
                Our Vision
              </h2>
              <p className="text-[var(--t-text-2)] text-sm leading-relaxed">
                Our vision is to combine our expertise with a truly personal connection to help you look and feel your absolute best.
              </p>
            </div>
          </div>
        </section>

        {/* Credentials */}
        <section className="py-16 lg:py-24 bg-[var(--t-bg-2)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <h2
              className="t-display font-light text-[var(--t-text)] mb-10"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}
            >
              Vasanthi&apos;s Professional Credentials
            </h2>
            <ul className="space-y-4 max-w-lg">
              {[
                { title: 'Diploma in Hairdressing', detail: 'Ramani Fernando Academy' },
                { title: 'Diploma in Advanced Beauty Therapy', detail: 'Roots Academy Bambalapitiya' },
                { title: 'NVQ Level 4', detail: 'Hairdressing & Beauty Therapy' },
                { title: 'NVQ Level 3', detail: 'Nail Technology' },
                { title: 'Founder & Lead Artist', detail: 'Vasanthi Gulasekharam Salon — 7+ Years of Business Excellence' },
              ].map((c, i) => (
                <li key={i} className="flex items-start gap-4 border-b border-[var(--t-border)] pb-4">
                  <span className="t-label text-[var(--t-text-3)] w-6 shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <span className="text-[var(--t-text)] text-sm font-medium">{c.title}</span>
                    <span className="text-[var(--t-text-3)] text-sm"> | {c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-28" style={{ background: 'linear-gradient(135deg, #EFE4D7 0%, #EFEBE2 100%)' }}>
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12 text-center">
            <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Ready?</p>
            <h2
              className="t-display font-light text-[var(--t-text)] mb-6"
              style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
            >
              Return to Your Best Self Today
            </h2>
            <Link href="/booking" className="t-btn t-btn-accent">
              Reserve Your Session
            </Link>
            <p className="t-label text-[var(--t-text-3)] tracking-[0.2em] mt-6 text-[0.65rem]">
              No registration required · Instant Confirmation
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
