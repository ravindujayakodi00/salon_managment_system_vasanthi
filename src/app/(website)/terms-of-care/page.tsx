import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';

export const metadata: Metadata = {
  title: 'Terms of Care — Vasanthi Gulasekharam Salon',
  description: 'Our commitment to maintaining a serene, private, and professional environment for every guest at Vasanthi Gulasekharam Salon.',
};

const sections = [
  {
    title: "A 'Ladies Only' Space",
    body: "To maintain a private and comfortable environment for all our guests, our salon is a dedicated ladies-only space.",
  },
  {
    title: 'By Prior Appointment Only',
    body: 'To ensure each guest receives our undivided attention and a truly private experience, we operate strictly by prior reservation. We do not accept walk-in appointments, allowing us to keep our salon calm and focused for your scheduled transformation.',
  },
  {
    title: 'Reservations & Deposits',
    body: 'To secure your dedicated time, certain appointments may require a non-refundable advance payment. If a deposit is required for your service, our team will get in touch with you to guide you through the process.',
  },
  {
    title: 'The Gift of Time — Arrival Policy',
    body: 'We invite you to arrive exactly at your scheduled time to settle into the salon. To honor the flow of our salon and the time of every client, arrivals more than 15 minutes late may require to have their service adjusted to fit the remaining time or be asked to reschedule.',
    emphasis: 'arrivals more than 15 minutes late may require to have their service adjusted to fit the remaining time or be asked to reschedule.',
  },
  {
    title: 'Rescheduling & Courtesy',
    body: 'We understand that plans may change. As we dedicate a specific block of time exclusively to you, we gracefully request at least 24 hours\u2019 notice for any cancellations or adjustments to your reservation. Please note that late cancellations or missed appointments without notice may result in the requirement of a full deposit to secure any future bookings.',
  },
  {
    title: 'Wellness & Allergies',
    body: 'Your safety is a core part of our responsibility. We kindly ask that you inform us of any skin sensitivities, allergies, or health conditions during your initial consultation. To ensure the best results, a patch test is required 48 hours prior to all first-time technical hair coloring or advanced skin treatments.',
  },
  {
    title: 'Sugaring & Skin Health',
    body: 'As Sugaring is a skin-brightening and exfoliating treatment, we prioritize your skin\u2019s integrity. Please inform us if you are currently using Retin-A, Accutane, or any prescription skin medications, as these can increase skin sensitivity. We reserve the right to reschedule a session if the skin condition is not optimal for the treatment to ensure your safety.',
  },
];

export default function TermsOfCarePage() {
  return (
    <>
      <Navbar alwaysVisible />

      <main className="bg-[var(--t-bg)] min-h-screen">

        {/* Page Hero */}
        <section className="pt-36 pb-16 lg:pt-44 lg:pb-20 bg-[var(--t-bg-dark)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <p className="t-label text-white/40 tracking-[0.3em] mb-5">Our Standards</p>
            <h1
              className="t-display font-light text-white leading-[1.1] mb-5"
              style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}
            >
              Our Commitment<br />
              <em className="t-script font-normal" style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.5rem)' }}>
                to Your Care
              </em>
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-lg">
              To maintain a serene environment for every individual, we kindly ask you to observe the following etiquette.
            </p>
          </div>
        </section>

        {/* Intro note */}
        <section className="py-14 lg:py-20 bg-[var(--t-bg-2)]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-2xl">
              <p
                className="t-display font-light italic text-[var(--t-text-2)] leading-relaxed"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
              >
                This page is not a cold legal document. It is a guide on how we maintain our standards of care and privacy for every guest who walks through our doors.
              </p>
            </div>
          </div>
        </section>

        {/* Terms sections */}
        <section className="py-16 lg:py-24">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-3xl">
              <div className="border-t border-[var(--t-border)]">
                {sections.map((section, i) => (
                  <div key={i} className="border-b border-[var(--t-border)] py-8 lg:py-10 grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5 lg:gap-16">
                    {/* Left: title */}
                    <div className="flex items-start gap-4">
                      <span className="t-label text-[var(--t-text-3)] shrink-0 pt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h2
                        className="t-display font-light text-[var(--t-text)]"
                        style={{ fontSize: 'clamp(1rem, 1.8vw, 1.2rem)' }}
                      >
                        {section.title}
                      </h2>
                    </div>

                    {/* Right: body */}
                    <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed pl-8 lg:pl-0">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
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
