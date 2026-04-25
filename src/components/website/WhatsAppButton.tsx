'use client';

import { FaWhatsapp } from 'react-icons/fa';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/94776300577"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-13 h-13 flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110"
      style={{ width: '52px', height: '52px', backgroundColor: '#25D366' }}
    >
      <FaWhatsapp size={26} color="#fff" />
    </a>
  );
}
