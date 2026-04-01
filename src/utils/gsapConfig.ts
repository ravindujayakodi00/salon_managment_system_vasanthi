import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

export const fadeInUp = {
  opacity: 0,
  y: 60,
  duration: 1,
  ease: 'power3.out',
};

export const fadeIn = {
  opacity: 0,
  duration: 1,
  ease: 'power2.out',
};

export const scaleIn = {
  scale: 0.8,
  opacity: 0,
  duration: 0.8,
  ease: 'back.out(1.7)',
};

export const slideInLeft = {
  x: -100,
  opacity: 0,
  duration: 1,
  ease: 'power3.out',
};

export const slideInRight = {
  x: 100,
  opacity: 0,
  duration: 1,
  ease: 'power3.out',
};

export const staggerConfig = {
  amount: 0.5,
  from: 'start',
};

export const createScrollTrigger = (
  trigger: string | Element,
  animations: gsap.TweenVars,
  options?: ScrollTrigger.Vars
) => {
  return gsap.from(trigger, {
    ...animations,
    scrollTrigger: {
      trigger,
      start: 'top 80%',
      end: 'bottom 20%',
      toggleActions: 'play none none reverse',
      ...options,
    },
  });
};
