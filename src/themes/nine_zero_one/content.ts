// Vasanthi Salon — Content & Copy
// Based on: @vasanthi.gulasekharam_salon on Instagram

export const content = {
  salonName: 'Vasanthi Gulasekharam Salon',
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
      { number: '01', title: 'Sugaring',  description: 'A gentle and natural way to remove hair while deeply exfoliating the skin.' },
      { number: '02', title: 'Hair',      description: 'From precision cuts and trendy color techniques to hair treatments, we offer everything to keep your hair healthy and stylish.' },
      { number: '03', title: 'Nails',     description: 'From trendy art and classic French tips to natural, neutral styles, we ensure your nails always get noticed.' },
      { number: '04', title: 'Facials',   description: 'Our Facials are tailored to restore your skin\'s natural glow and radiance.' },
      { number: '05', title: 'Spa',       description: 'Experience a personal escape designed to refresh your mind, restore your energy. Our massage therapies are specifically tailored to meet your body\'s unique needs.' },
    ],
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
