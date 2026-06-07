import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import { content, type ServiceItem } from '@/themes/nine_zero_one/content';
import { SALON_OWNER_FIRST } from '@/config/salon';

// Build all static paths at build time
export function generateStaticParams() {
  return content.services.items.map(s => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service: ServiceItem | undefined = content.services.items.find(s => s.slug === slug);
  if (!service) return {};
  return {
    title: `${service.title} — ${content.salonName}`,
    description: service.description,
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service: ServiceItem | undefined = content.services.items.find(s => s.slug === slug);

  if (!service) notFound();

  // TypeScript guard — notFound() throws but TS doesn't know that
  const s = service as ServiceItem;

  // Adjacent services for prev/next navigation
  const currentIndex = content.services.items.findIndex(item => item.slug === slug);
  const prevService  = content.services.items[currentIndex - 1] ?? null;
  const nextService  = content.services.items[currentIndex + 1] ?? null;

  return (
    <>
      <Navbar alwaysVisible />

      <main className="bg-[var(--t-bg)] min-h-screen">

        {/* ── Hero ── */}
        <section className="pt-36 pb-0 lg:pt-44 bg-[var(--t-bg-dark)] overflow-hidden">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-end">

              {/* Text */}
              <div className="pb-16 lg:pb-24">
                <Link
                  href="/#services"
                  className="inline-flex items-center gap-2 t-label text-white/40 tracking-[0.25em] mb-8 hover:text-white/70 transition-colors duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 2L4 7l5 5" />
                  </svg>
                  Our Services
                </Link>
                <p className="t-label text-white/40 tracking-[0.3em] mb-5">{s.number}</p>
                <h1
                  className="t-display font-light text-white leading-[1.05] mb-6"
                  style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)' }}
                >
                  {s.title}
                  <br />
                  <em className="t-script font-normal text-[var(--t-accent)]" style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.6rem)' }}>
                    at {SALON_OWNER_FIRST}&apos;s
                  </em>
                </h1>
                <p className="t-body text-white/60 text-sm leading-relaxed max-w-sm">
                  {s.description}
                </p>
              </div>

              {/* Hero image */}
              <div className="relative h-[300px] lg:h-[500px] w-full">
                <Image
                  src={s.image}
                  alt={s.title}
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

        {/* ── Full Description ── */}
        <section className="py-20 lg:py-28">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
            <div className="max-w-3xl">
              <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">About This Service</p>
              <p
                className="t-display font-light italic text-[var(--t-text-2)] leading-relaxed"
                style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)' }}
              >
                {s.fullDescription}
              </p>
            </div>
          </div>
        </section>

        {/* ── Preparation Steps (only if present) ── */}
        {s.prepSteps && s.prepSteps.length > 0 && (
          <section className="py-20 lg:py-28 bg-[var(--t-bg-2)]">
            <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
              <div className="max-w-3xl">
                <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Before You Arrive</p>
                <h2
                  className="t-display font-light text-[var(--t-text)] mb-4"
                  style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
                >
                  {s.prepTitle}
                </h2>
                {s.prepIntro && (
                  <p className="t-body text-[var(--t-text-2)] text-sm leading-relaxed mb-10">
                    {s.prepIntro}
                  </p>
                )}
                <ul className="space-y-0 border-t border-[var(--t-border)]">
                  {s.prepSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-5 border-b border-[var(--t-border)] py-5">
                      <span className="t-label text-[var(--t-accent)] w-6 shrink-0 pt-0.5">→</span>
                      <div>
                        <span className="t-body text-[var(--t-text)] text-sm font-medium">{step.label}: </span>
                        <span className="t-body text-[var(--t-text-2)] text-sm leading-relaxed">{step.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Price List ── */}
        {(() => {
          const priceListMap: Record<string, string> = {
            sugaring: '/price-lists/wax-prices.jpeg',
            hair:     '/price-lists/hair-prices.jpeg',
            nails:    '/price-lists/nails-prices.jpeg',
            facials:  '/price-lists/facials-prices.jpeg',
            spa:      '/price-lists/spa-prices.jpeg',
          };
          const priceImage = priceListMap[slug];
          if (!priceImage) return null;
          return (
            <section className={`py-20 lg:py-28 ${s.prepSteps && s.prepSteps.length > 0 ? '' : 'bg-[var(--t-bg-2)]'}`}>
              <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
                <div className="max-w-3xl">
                  <p className="t-label text-[var(--t-text-3)] tracking-[0.3em] mb-4">Pricing</p>
                  <h2
                    className="t-display font-light text-[var(--t-text)] mb-8"
                    style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
                  >
                    {s.title} Price List
                  </h2>
                  <div className="relative w-full">
                    <Image
                      src={priceImage}
                      alt={`${s.title} price list`}
                      width={900}
                      height={1200}
                      className="w-full h-auto rounded-sm"
                      quality={90}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── Prev / Next navigation ── */}
        {(prevService || nextService) && (
          <section className="py-12 lg:py-16 border-t border-[var(--t-border)]">
            <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
              <div className="flex justify-between items-center gap-6">
                {prevService ? (
                  <Link
                    href={`/services/${prevService.slug}`}
                    className="group flex items-center gap-3 t-label text-[var(--t-text-3)] hover:text-[var(--t-text)] transition-colors duration-200"
                  >
                    <span className="group-hover:-translate-x-1 transition-transform duration-200">←</span>
                    <span>{prevService.title}</span>
                  </Link>
                ) : <div />}

                {nextService ? (
                  <Link
                    href={`/services/${nextService.slug}`}
                    className="group flex items-center gap-3 t-label text-[var(--t-text-3)] hover:text-[var(--t-text)] transition-colors duration-200"
                  >
                    <span>{nextService.title}</span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </Link>
                ) : <div />}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA ── */}
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
