// Salon Content & Copy
// Based on: @vasanthi.gulasekharam_salon on Instagram

import { SALON_NAME } from '@/config/salon';

export interface ServiceItem {
  number: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  fullDescription: string;
  prepTitle: string;
  prepIntro: string;
  prepSteps: { label: string; detail: string }[];
}

export const content = {
  salonName: SALON_NAME,
  tagline:   'Professional Care. Personal Attention',

  hero: {
    label:        'Award-Winning Salon',
    heading:      ['Professional Care.', 'Personal Attention'],
    subtext:      'Experience the luxury of undivided attention in a space that feels entirely your own.',
    ctaPrimary:   'Reserve Your Session',
    ctaSecondary: 'Explore Our Services',
  },

  services: {
    heading: 'Our Services',
    label:   'What We Offer',
    subtext: 'A curated selection of premium beauty treatments',
    items: [
      {
        number: '01', title: 'Sugaring', slug: 'sugaring',
        description: 'A gentle and natural way to remove hair while deeply exfoliating the skin.',
        image: '/gallery/nail-art-image.jpg',
        fullDescription: 'Step into a gentler way of caring for your body. Our Sugaring service is much more than hair removal; it is a 100% natural ritual that uses a simple paste of sugar, lemon, and water to treat your skin with the respect it deserves. Unlike traditional waxing, our unique technique removes hair from the root in its natural direction of growth, leading to significant hair reduction over time with minimal irritation. This method also acts as a deep exfoliation, clearing away dead skin cells to reveal a brighter, softer, and healthier skin.',
        prepTitle: 'How should you prepare for your Sugaring session?',
        prepIntro: 'To ensure a seamless and comfortable experience, we recommend the following preparation:',
        prepSteps: [
          { label: 'Hair Length', detail: 'For the best results, hair should be about the length of a grain of rice (approximately 1/4 inch).' },
          { label: 'Skin Prep', detail: 'Gently exfoliate the area 24–48 hours before your appointment.' },
          { label: 'Skin Prep', detail: 'Please arrive with clean skin, free of lotions, oils, or deodorants in the area being treated.' },
          { label: 'What to Wear', detail: 'We highly recommend wearing loose, comfortable clothing for your session. Please avoid tight jeans or restrictive clothing, as your skin will be sensitive and needs space to breathe immediately after the treatment.' },
        ],
      },
      {
        number: '02', title: 'Hair', slug: 'hair',
        description: 'From precision cuts and trendy color techniques to hair treatments, we offer everything to keep your hair healthy and stylish.',
        image: '/gallery/hair-coloring-image-1.jpg',
        fullDescription: 'Your hair is your most personal signature, and at our salon, it is treated as a work of art. From precision cuts and trendy color techniques to restorative treatments, we provide a full range of services to ensure your hair remains healthy, stylish, and uniquely yours.',
        prepTitle: '', prepIntro: '', prepSteps: [],
      },
      {
        number: '03', title: 'Nails', slug: 'nails',
        description: 'From trendy art and classic French tips to natural, neutral styles, we ensure your nails always get noticed.',
        image: '/gallery/nail-art-image.jpg',
        fullDescription: 'Beautiful, well-kept nails are a reflection of personal care. From quick refreshes to deep-care sessions, every treatment is designed to prioritize both the beauty and the health of your nails.',
        prepTitle: '', prepIntro: '', prepSteps: [],
      },
      {
        number: '04', title: 'Facials', slug: 'facials',
        description: 'Our Facials are tailored to restore your skin\'s natural glow and radiance.',
        image: '/gallery/hair-washing.jpg',
        fullDescription: 'We believe skincare should be as unique as you are. Using world-renowned Casmara products and advanced LED technology, we offer a range of result-driven treatments designed to restore your skin\'s natural health, clarity, and radiance.',
        prepTitle: '', prepIntro: '', prepSteps: [],
      },
      {
        number: '05', title: 'Spa', slug: 'spa',
        description: 'Experience a personal escape designed to refresh your mind, restore your energy. Our massage therapies are specifically tailored to meet your body\'s unique needs.',
        image: '/gallery/salon-chair-vertical.jpg',
        fullDescription: 'Escape the noise of the outside world and settle into a personal journey of restoration. Our spa therapies are designed and tailored to refresh your mind and restore your energy through deeply personal wellness sessions. This is your time to unburden, reset, and experience the luxury of true stillness.',
        prepTitle: '', prepIntro: '', prepSteps: [],
      },
    ] as ServiceItem[],
  },

  gallery: {
    label:   'Portfolio',
    heading: 'The Beauty of Being Seen',
    subtext: 'Step away from the hurried pace of conventional beauty into an intimate, one-on-one beauty destination. We have traded the shared atmosphere of high-traffic salons for a dedicated 1:1 experience, because your beauty deserves a customized creation, not just a standard solution.',
    images: [
      { id: 1, type: 'video', alt: 'Where Beauty Begins',   src: '/gallery/gallery-video-1.mp4',          wide: true,  orientation: 'landscape' },
      { id: 2, type: 'image', alt: 'The Studio',           src: '/gallery/salon-image-horizontal.jpg',   wide: true,  orientation: 'landscape' },
      { id: 3, type: 'image', alt: 'Pure Ritual',          src: '/gallery/hair-washing.jpg',              wide: true,  orientation: 'landscape' },
      { id: 4, type: 'image', alt: 'Precision Craft',      src: '/gallery/nail-art-image.jpg',            wide: true,  orientation: 'portrait'  },
      { id: 5, type: 'image', alt: 'Colour Mastery',       src: '/gallery/hair-coloring-image-1.jpg',    wide: false, orientation: 'portrait'  },
      { id: 6, type: 'image', alt: 'The Transformation',   src: '/gallery/hair-coloring-image-2.jpg',    wide: false, orientation: 'portrait'  },
      { id: 7, type: 'image', alt: 'Sculpted Perfection',  src: '/gallery/hair-cutting-image-1.jpg',     wide: false, orientation: 'portrait'  },
      { id: 8, type: 'image', alt: 'Your Throne',          src: '/gallery/salon-chair-vertical.jpg',     wide: false, orientation: 'portrait'  },
    ],
  },

  testimonials: {
    label:   'A Shared Journey of Elegance.',
    heading: 'Client Testimonials',
    items: [
      { quote: 'Vasanthi\'s studio feels less like a salon and more like a second home. It is the only place where I feel truly seen and heard.', name: 'Client Name', service: 'Bridal Package' },
      { quote: 'Best salon experience I have ever had. The hair treatment left my hair incredibly smooth and shiny for weeks.', name: 'Nisha R.', service: 'Hair Treatment' },
      { quote: 'I have been a regular client for over three years. The quality and care here is unmatched anywhere else in the city.', name: 'Divya M.', service: 'Skin Treatments' },
      { quote: 'My nails have never looked this beautiful. The nail art was exactly what I wanted and the service was so professional.', name: 'Anitha S.', service: 'Nail Care' },
    ],
  },

  cta: {
    label:      'Ready?',
    heading:    'Return to Your Best Self Today',
    subtext:    'Whether you are preparing for your wedding day or seeking a quiet moment of self-care, our doors are open for you.',
    buttonText: 'Reserve Your Session',
    footnote:   'No registration required · Instant Confirmation',
  },

  contact: {
    label:   'Contact Us',
    heading: 'Find Us',
    subtext: 'Visit our salon or get in touch',
    address: ['No. 22, G. H. Perera Mawatha,', 'Raththanapitiya,', 'Borelasgamuwa'],
    phones:  ['0776300577'],
    emails:  ['vasanthi.salon@gmail.com'],
    hours:   ['Mon, Wed – Sat: 9:00 AM – 7:00 PM', 'Tue: 9:00 AM – 10:00 PM', 'Sun: Closed'],
    mapUrl:  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.9!2d79.856!3d6.914!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwNTQnNTAuNiJOIDc5wrA1MSczMy42IkU!5e0!3m2!1sen!2slk!4v1',
  },

  expertise: {
    heading:    'Our Expertise',
    scrollHint: 'Scroll to explore',
    items: [
      {
        id:          1,
        number:      '01',
        title:       'Bridal Artistry',
        description: 'Timeless bridal looks crafted with precision — from traditional to contemporary styles for your most special day.',
        image:       'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
      },
      {
        id:          2,
        number:      '02',
        title:       'Hair Transformation',
        description: 'Expert cuts, colour, keratin and smoothening treatments that bring out the best version of your hair.',
        image:       'https://images.unsplash.com/photo-1560869713-7d0a29430803?q=80&w=2026&auto=format&fit=crop',
      },
      {
        id:          3,
        number:      '03',
        title:       'Skin & Glow',
        description: 'Advanced facials, clean-ups and personalised skincare regimens for radiant, healthy skin.',
        image:       'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=2070&auto=format&fit=crop',
      },
      {
        id:          4,
        number:      '04',
        title:       'Nail Couture',
        description: 'Intricate nail art, gel extensions and classic manicures by our certified nail technicians.',
        image:       'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1974&auto=format&fit=crop',
      },
    ],
  },

  footer: {
    tagline: 'Professional Care. Personal Attention.',
    links: [
      { name: 'Our Journey',        href: '/our-journey'   },
      { name: 'Services',           href: '/#services'     },
      { name: 'Testimonials',       href: '/#testimonials' },
      { name: 'FAQ',                href: '/faq'           },
      { name: 'Terms & Conditions', href: '/terms-of-care' },
      { name: 'Contact',            href: '/#contact'      },
    ],
    socials: [
      { name: 'Instagram', href: 'https://www.instagram.com/vasanthi.gulasekharam_salon/', letter: 'IG' },
      { name: 'Facebook',  href: 'https://www.facebook.com/vasanthiGulasekharamsSalon/', letter: 'FB' },
      { name: 'TikTok',   href: 'https://www.tiktok.com/@vasanthigulasekharam', letter: 'TK' },
    ],
  },
}
