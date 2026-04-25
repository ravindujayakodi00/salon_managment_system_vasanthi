'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';

const faqs = [
  {
    question: 'What makes the Vasanthi Gulasekharam experience different?',
    answer: 'Unlike high-traffic salons, we offer a dedicated 1:1 experience. From the moment you enter our boutique, you are the only focus of us.',
  },
  {
    question: 'Do I need to book in advance?',
    answer: 'Yes. Because we prioritize private appointments to avoid a "rush" atmosphere, we recommend reserving your session at least 02 days in advance.',
  },
  {
    question: 'Can I book a consultation for my wedding?',
    answer: 'Absolutely. We specialize in bridal. We recommend requesting a bridal consultation at least 3–6 months before your day to begin your tailored transformation.',
  },
  {
    question: 'How do I pay for my services?',
    answer: 'We accept cash, bank transfers, and card payments. Payment is due upon completion of your service.',
  },
  {
    question: 'Do you offer professional makeup services?',
    answer: 'Yes. Vasanthi specializes in editorial, party, and occasion makeup that emphasizes your natural features. Like all our services, makeup sessions are conducted 1:1 in our private studio to ensure your look is perfected under the best light and with undivided attention.',
  },
  {
    question: 'What is Sugaring, and how is it different from waxing?',
    answer: 'Sugaring is a 100% natural hair removal method using a simple paste of sugar, lemon, and water. Unlike traditional waxing, this method removes hair from the root, which leads to a significant reduction in hair growth over time. Because the paste is applied at room temperature, it does not burn or peel the skin like waxing can. It is much gentler, ensuring minimal to no irritation while leaving your skin feeling bright and smooth.',
  },
  {
    question: 'How should I prepare for my Sugaring session?',
    answer: 'Hair Length: For the best results, hair should be about the length of a grain of rice (approximately 1/4 inch).\n\nSkin Prep: Gently exfoliate the area 24–48 hours before your appointment, and arrive with clean skin, free of lotions, oils, or deodorants in the area being treated.\n\nWhat to Wear: We highly recommend wearing loose, comfortable clothing. Please avoid tight jeans or restrictive clothing, as your skin will be sensitive and needs space to breathe immediately after the treatment.',
  },
  {
    question: 'What is the recommended after-care for Sugaring?',
    answer: 'To maintain your post-glow, avoid heat, friction, and scented products for 24 hours. This includes hot baths, gym sessions, and tanning. We recommend regular hydration and gentle exfoliation starting 48 hours after your session to prevent ingrown hairs.',
  },
  {
    question: 'Why is Sugaring priced differently than traditional waxing?',
    answer: 'Sugaring is a premium, high-skill treatment that offers far more than standard hair removal. Unlike traditional methods, it requires a specialized hand technique that is both labor-intensive and time-consuming, ensuring that every hair is meticulously removed from the root. This detailed approach results in significant hair reduction over time and serves as a deep skin treatment, exfoliating dead cells to reveal a brighter and healthier complexion.',
  },
  {
    question: "I've heard Sugaring can be time-consuming. Is it worth it?",
    answer: "We know your time is valuable, and that is precisely why we invest it in this technique. Sugaring is not a quick fix; it is a premium, high-skill treatment focused on the long-term health of your skin. By choosing this careful, natural process over a fast-paced chemical service, you are trading immediate time-savings for lasting smoothness, significantly reduced irritation, and brighter skin health.",
  },
  {
    question: 'What is the difference between Express Sugaring and Advanced Sugaring?',
    answer: 'Advanced Sugaring (Our Premium Standard): This is the ideal option for those focused on the full therapeutic benefits of Sugaring. It is a slower, more detailed process designed to achieve superior, long-term hair reduction and a smoother result that lasts 4+ weeks. Regular Advanced sessions ensure hair grows back softer and finer.\n\nExpress Sugaring: This option is a faster, more convenient alternative focused on efficiency. It is perfect for a quick refresh between Advanced appointments. Please note that results do not last as long, and hair may grow back faster and thicker compared to the Advanced method.',
  },
];

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[var(--t-border)]">
      <button
        className="w-full flex items-start justify-between gap-6 py-6 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-5">
          <span className="t-label text-[var(--t-text-3)] shrink-0 pt-0.5">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            className="t-display font-light text-[var(--t-text)]"
            style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.2rem)' }}
          >
            {question}
          </span>
        </div>
        <span
          className={`shrink-0 text-[var(--t-accent)] transition-transform duration-300 mt-0.5 ${open ? 'rotate-45' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 3v12M3 9h12" />
          </svg>
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px] pb-6' : 'max-h-0'}`}
      >
        <div className="pl-10 pr-6">
          {answer.split('\n\n').map((para, i) => (
            <p key={i} className="text-[var(--t-text-2)] text-sm leading-relaxed mb-3 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
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
              FAQ
            </h1>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Everything you need to know about your journey with us.
            </p>
          </div>
        </section>

        {/* FAQ List */}
        <section className="py-16 lg:py-24">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-3xl border-t border-[var(--t-border)]">
              {faqs.map((faq, i) => (
                <FAQItem key={i} question={faq.question} answer={faq.answer} index={i} />
              ))}
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
