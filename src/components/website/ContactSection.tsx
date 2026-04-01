'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/utils/gsapConfig';

export default function ContactSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        service: '',
        message: '',
    });

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from('.contact-title', {
                opacity: 0,
                y: 50,
                duration: 1,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 70%',
                },
            });

            gsap.from('.contact-form', {
                opacity: 0,
                x: -50,
                duration: 0.8,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 60%',
                },
            });

            gsap.from('.contact-info', {
                opacity: 0,
                x: 50,
                duration: 0.8,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 60%',
                },
            });
        });

        return () => ctx.revert();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <section
            ref={sectionRef}
            id="contact"
            className="py-20 px-4 relative z-10"
        >
            <div className="container mx-auto max-w-7xl">
                <div className="text-center mb-16 contact-title">
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 gradient-text drop-shadow-sm">
                        Get In Touch
                    </h2>
                    <p className="text-lg sm:text-xl text-[var(--t-text-2)] max-w-2xl mx-auto">
                        Book your appointment or reach out to us with any questions
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Form */}
                    <div className="contact-form glass p-8 rounded-3xl">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[var(--t-text)] font-semibold mb-2">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-[var(--t-border-2)] bg-[var(--t-bg)] text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:border-[var(--t-accent)] focus:outline-none transition-all"
                                    placeholder="Your full name"
                                />
                            </div>

                            <div>
                                <label className="block text-[var(--t-text)] font-semibold mb-2">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-[var(--t-border-2)] bg-[var(--t-bg)] text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:border-[var(--t-accent)] focus:outline-none transition-all"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-[var(--t-text)] font-semibold mb-2">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-[var(--t-border-2)] bg-[var(--t-bg)] text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:border-[var(--t-accent)] focus:outline-none transition-all"
                                    placeholder="+94 77 123 4567"
                                />
                            </div>

                            <div>
                                <label className="block text-[var(--t-text)] font-semibold mb-2">
                                    Service
                                </label>
                                <select
                                    name="service"
                                    value={formData.service}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-[var(--t-border-2)] bg-[var(--t-bg)] text-[var(--t-text)] focus:border-[var(--t-accent)] focus:outline-none transition-all"
                                >
                                    <option value="">Select a service</option>
                                    <option value="hair">Hair Styling</option>
                                    <option value="nails">Nail Care</option>
                                    <option value="spa">Spa Treatments</option>
                                    <option value="makeup">Makeup</option>
                                    <option value="bridal">Bridal Package</option>
                                    <option value="skincare">Skin Care</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[var(--t-text)] font-semibold mb-2">
                                    Message
                                </label>
                                <textarea
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    rows={4}
                                    className="w-full px-4 py-3 border border-[var(--t-border-2)] bg-[var(--t-bg)] text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:border-[var(--t-accent)] focus:outline-none transition-all resize-none"
                                    placeholder="Tell us about your needs..."
                                />
                            </div>

                            <button type="submit" className="btn-primary w-full shadow-lg">
                                Send Message
                            </button>
                        </form>
                    </div>

                    {/* Contact Info */}
                    <div className="contact-info space-y-8">
                        <div className="glass p-8">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 border border-[var(--t-border-2)] flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-[var(--t-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="t-display font-light text-[var(--t-text)] mb-2">Location</h3>
                                    <p className="text-[var(--t-text-2)] text-sm">No. 2/1, Gnanam Road<br />Bambalapitiya, Colombo 04</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass p-8">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 border border-[var(--t-border-2)] flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-[var(--t-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="t-display font-light text-[var(--t-text)] mb-2">Phone</h3>
                                    <p className="text-[var(--t-text-2)] text-sm">+94 77 123 4567</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass p-8">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 border border-[var(--t-border-2)] flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-[var(--t-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="t-display font-light text-[var(--t-text)] mb-2">Hours</h3>
                                    <p className="text-[var(--t-text-2)] text-sm">
                                        Mon – Sat: 9:00 AM – 7:00 PM<br />
                                        Sunday: Closed
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
