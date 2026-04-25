import type { Metadata } from 'next';
import Image from 'next/image';
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
        <section className="pt-36 pb-0 lg:pt-44 bg-[var(--t-bg-dark)] overflow-hidden">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-end">

              {/* Left: text */}
              <div className="pb-16 lg:pb-24">
                <p className="t-label text-white/40 tracking-[0.3em] mb-6">Our Story</p>
                <h1
                  className="t-display font-light text-white leading-[1.05] mb-6"
                  style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)' }}
                >
                  Professional Care.<br />
                  <em className="t-script font-normal" style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}>
                    Personal Attention.
                  </em>
                </h1>
                <p className="t-display font-light italic text-white/60 leading-relaxed max-w-md" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.3rem)' }}>
                  The Journey of Vasanthi Gulasekharam
                </p>
              </div>

              {/* Right: image */}
              <div className="relative h-[320px] lg:h-[520px] w-full">
                <Image
                  src="/gallery/salon-image-horizontal.jpg"
                  alt="Vasanthi Gulasekharam Salon"
                  fill
                  className="object-cover object-center"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={85}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#302621]/60 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* A Legacy of Expertise */}
        <section className="py-20 lg:py-28">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">

              {/* Image */}
              <div className="relative h-[380px] lg:h-[560px] w-full order-2 lg:order-1">
                <Image
                  src="/gallery/salon-chair-vertical.jpg"
                  alt="A Legacy of Expertise"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={80}
                  loading="lazy"
                />
              </div>

              {/* Text */}
              <div className="order-1 lg:order-2">
                <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Background</p>
                <h2
                  className="t-display font-light text-[var(--t-text)] mb-8"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
                >
                  A Legacy of Expertise
                </h2>
                <div className="space-y-5">
                  <p className="t-display font-light italic text-[var(--t-text)]" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.25rem)' }}>
                    True beauty is never a standard solution; it is a personal dialogue between the artist and the client.
                  </p>
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    With over a decade of experience in the beauty industry, Vasanthi Gulasekharam is a skilled and passionate professional dedicated to the art of transformation. Her journey is built on a foundation of world-class education, having honed her skills at prestigious institutions including the <strong className="text-[var(--t-text)] font-medium">Ramani Fernando Academy</strong> and <strong className="text-[var(--t-text)] font-medium">Roots Academy Bambalapitiya</strong>.
                  </p>
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    Holding Diplomas in both Hairdressing and Advanced Beauty Therapy, along with NVQ Level 4 certifications in both disciplines and an NVQ Level 3 in Nail Technology, Vasanthi&apos;s mastery is backed by rigorous technical excellence.
                  </p>
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    For the past seven years, Vasanthi has successfully managed her own beauty business, bringing a wealth of practical knowledge and a keen eye for detail to every interaction.
                  </p>
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    By moving away from the hurried pace of mass-market salons, she has created a <strong className="text-[var(--t-text)] font-medium">Private Space for Beauty</strong> — a dedicated 1:1 boutique where the noise of the outside world fades away, leaving room for focused, uninterrupted sessions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Commitment */}
        <section className="py-20 lg:py-28 bg-[var(--t-bg-2)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">

              {/* Text */}
              <div>
                <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Our Promise</p>
                <h2
                  className="t-display font-light text-[var(--t-text)] mb-8"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
                >
                  Our Commitment
                </h2>
                <div className="space-y-5">
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    At Vasanthi Gulasekharam Salons, you are not just an appointment; you are our main guest. We provide undivided attention, ensuring that every snip, every shade, and every skin treatment is curated specifically for your features, your lifestyle, and your vision.
                  </p>
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">
                    We believe that every client deserves a personalized experience. From our clinical standards of hygiene to the personalized nature of our consultations, every element of our salon is designed for the discerning individual who seeks excellence in a space that feels like home and for those who seek more than just a salon visit.
                  </p>
                </div>
              </div>

              {/* Image */}
              <div className="relative h-[360px] lg:h-[500px] w-full">
                <Image
                  src="/gallery/hair-washing.jpg"
                  alt="Our Commitment to Care"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={80}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Our Vision */}
        <section className="py-20 lg:py-28">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-3xl">
              <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Looking Ahead</p>
              <h2
                className="t-display font-light text-[var(--t-text)] mb-6"
                style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
              >
                Our Vision
              </h2>
              <p className="t-display font-light italic text-[var(--t-text-2)] leading-relaxed" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}>
                Our vision is to combine our expertise with a truly personal connection to help you look and feel your absolute best.
              </p>
            </div>
          </div>
        </section>

        {/* Credentials */}
        <section className="py-20 lg:py-28 bg-[var(--t-bg-2)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-start">

              {/* Left: heading + image */}
              <div>
                <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Qualifications</p>
                <h2
                  className="t-display font-light text-[var(--t-text)] mb-10"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
                >
                  Vasanthi&apos;s Professional Credentials
                </h2>
                <div className="relative h-[300px] lg:h-[380px] w-full">
                  <Image
                    src="/gallery/hair-cutting-image-1.jpg"
                    alt="Professional Excellence"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    quality={80}
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Right: list */}
              <div className="pt-0 lg:pt-20">
                <ul className="space-y-0 border-t border-[var(--t-border)]">
                  {[
                    { title: 'Diploma in Hairdressing', detail: 'Ramani Fernando Academy' },
                    { title: 'Diploma in Advanced Beauty Therapy', detail: 'Roots Academy Bambalapitiya' },
                    { title: 'NVQ Level 4', detail: 'Hairdressing & Beauty Therapy' },
                    { title: 'NVQ Level 3', detail: 'Nail Technology' },
                    { title: 'Founder & Lead Artist', detail: 'Vasanthi Gulasekharam Salon — 7+ Years of Business Excellence' },
                  ].map((c, i) => (
                    <li key={i} className="flex items-start gap-5 border-b border-[var(--t-border)] py-5">
                      <span className="t-label text-[var(--t-text-3)] w-6 shrink-0 pt-1">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className="t-body text-[var(--t-text)] text-sm font-medium mb-0.5">{c.title}</p>
                        <p className="t-body text-[var(--t-text-3)] text-xs">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 lg:py-32" style={{ background: 'linear-gradient(135deg, #EFE4D7 0%, #EFEBE2 100%)' }}>
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12 text-center">
            <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-5">Ready?</p>
            <h2
              className="t-display font-light text-[var(--t-text)] mb-8"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)' }}
            >
              Return to Your Best Self Today
            </h2>
            <Link href="/booking" className="t-btn t-btn-accent">
              Reserve Your Session
            </Link>
            <p className="t-label text-[var(--t-text-3)] tracking-[0.2em] mt-8 text-[0.65rem]">
              No registration required · Instant Confirmation
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
