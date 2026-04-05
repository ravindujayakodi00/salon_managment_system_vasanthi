/**
 * Build Tailwind-like primary/secondary CSS variable maps from a single hex seed.
 * Used to override --color-primary-* and --color-secondary-* at runtime.
 */

function normalizeHex(hex: string): string {
    const h = hex.trim().replace(/^#/, '');
    if (h.length === 3) {
        return h
            .split('')
            .map(c => c + c)
            .join('');
    }
    if (h.length !== 6) {
        return '4B5945';
    }
    return h;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const n = normalizeHex(hex);
    const v = parseInt(n, 16);
    if (!Number.isFinite(v)) {
        return { r: 75, g: 89, b: 69 }; /* olive seed — matches legacy default primary */
    }
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            default:
                h = ((r - g) / d + 4) / 6;
        }
    }
    return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hh = (((h % 360) + 360) % 360) / 360;
    let r: number;
    let g: number;
    let b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            let tt = t;
            if (tt < 0) tt += 1;
            if (tt > 1) tt -= 1;
            if (tt < 1 / 6) return p + (q - p) * 6 * tt;
            if (tt < 1 / 2) return q;
            if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, hh + 1 / 3);
        g = hue2rgb(p, q, hh);
        b = hue2rgb(p, q, hh - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

function rgbToHex(r: number, g: number, b: number): string {
    return (
        '#' +
        [r, g, b]
            .map(x =>
                Math.min(255, Math.max(0, x))
                    .toString(16)
                    .padStart(2, '0')
            )
            .join('')
    );
}

function hslToHex(h: number, s: number, l: number): string {
    const { r, g, b } = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
}

/** For box-shadow / ring alpha blends */
export function rgbaFromHex(hex: string, alpha: number): string {
    const { r, g, b } = hexToRgb(hex);
    const a = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const BRAND_TOKEN_KEYS = [
    '--brand-shadow-xs',
    '--brand-shadow-sm',
    '--brand-shadow-md',
    '--brand-shadow-lg',
    '--brand-shadow-dark-sm',
    '--brand-shadow-dark-md',
    '--brand-ring-soft',
    '--brand-glow-subtle',
] as const;

function applyBrandSemanticTokens(root: HTMLElement, primaryHex: string, secondaryHex: string): void {
    const p = generatePalette(primaryHex);
    const s = generatePalette(secondaryHex);
    const deep = p['700'];
    const mid = p['600'];
    const soft = p['400'];
    const sec = s['500'];

    // Layered shadows (same hue as brand — avoids “gray smudge” on custom colors)
    root.style.setProperty(
        '--brand-shadow-xs',
        `0 1px 2px ${rgbaFromHex(mid, 0.05)}, 0 1px 3px ${rgbaFromHex(deep, 0.06)}`
    );
    root.style.setProperty(
        '--brand-shadow-sm',
        `0 2px 4px -1px ${rgbaFromHex(mid, 0.07)}, 0 4px 10px -2px ${rgbaFromHex(deep, 0.09)}`
    );
    root.style.setProperty(
        '--brand-shadow-md',
        `0 6px 12px -2px ${rgbaFromHex(mid, 0.1)}, 0 12px 20px -4px ${rgbaFromHex(deep, 0.12)}`
    );
    root.style.setProperty(
        '--brand-shadow-lg',
        `0 10px 22px -4px ${rgbaFromHex(mid, 0.14)}, 0 24px 32px -8px ${rgbaFromHex(deep, 0.16)}`
    );

    // Dark-mode surfaces: slightly stronger tint so panels read on charcoal
    root.style.setProperty(
        '--brand-shadow-dark-sm',
        `0 2px 6px ${rgbaFromHex(soft, 0.14)}, 0 4px 14px ${rgbaFromHex(mid, 0.22)}`
    );
    root.style.setProperty(
        '--brand-shadow-dark-md',
        `0 8px 16px ${rgbaFromHex(mid, 0.2)}, 0 16px 28px ${rgbaFromHex(deep, 0.28)}`
    );

    // Focus / decorative (secondary accent)
    root.style.setProperty('--brand-ring-soft', rgbaFromHex(sec, 0.35));
    root.style.setProperty('--brand-glow-subtle', `0 0 0 3px ${rgbaFromHex(sec, 0.12)}`);
}

/** Reference lightness targets (0–100) for each step; 600 is anchored to the seed color. */
const STEP_KEYS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const REF_LIGHTNESS: Record<(typeof STEP_KEYS)[number], number> = {
    '50': 96,
    '100': 91,
    '200': 82,
    '300': 72,
    '400': 62,
    '500': 52,
    '600': 42,
    '700': 35,
    '800': 28,
    '900': 21,
    '950': 13,
};

/**
 * Returns a map of shade key -> hex color, e.g. { '50': '#f4f7f4', ..., '950': '#151a15' }
 */
export function generatePalette(seedHex: string): Record<string, string> {
    const { r, g, b } = hexToRgb(seedHex);
    const { h, s: s0, l: l600 } = rgbToHsl(r, g, b);
    const ref600 = REF_LIGHTNESS['600'];
    const delta = l600 * 100 - ref600;

    const out: Record<string, string> = {};
    for (const key of STEP_KEYS) {
        let L = (REF_LIGHTNESS[key] + delta) / 100;
        L = Math.min(0.985, Math.max(0.06, L));
        let sat = s0;
        if (key === '50' || key === '100') {
            sat = Math.max(0.05, s0 * 0.45);
        } else if (key === '200' || key === '300') {
            sat = Math.max(0.08, s0 * 0.75);
        }
        out[key] = hslToHex(h, sat, L);
    }
    return out;
}

/**
 * Apply palette to CSS custom properties on a root element (--color-{prefix}-50 ... --color-{prefix}-950).
 */
export function applyPaletteToRoot(
    root: HTMLElement,
    prefix: 'primary' | 'secondary',
    seedHex: string
): void {
    const palette = generatePalette(seedHex);
    for (const key of STEP_KEYS) {
        root.style.setProperty(`--color-${prefix}-${key}`, palette[key]);
    }
}

/**
 * Applies both palettes and optional accent hints for gradients / focus (uses primary 500 + secondary 400).
 */
export function applyOrganizationPalettes(
    root: HTMLElement,
    primaryHex: string,
    secondaryHex: string
): void {
    applyPaletteToRoot(root, 'primary', primaryHex);
    applyPaletteToRoot(root, 'secondary', secondaryHex);
    const p = generatePalette(primaryHex);
    const s = generatePalette(secondaryHex);
    root.style.setProperty('--brand-accent-mix', p['500']);
    root.style.setProperty('--brand-secondary-mix', s['400']);
    applyBrandSemanticTokens(root, primaryHex, secondaryHex);
}

/** Remove runtime brand tokens (e.g. tests or reset). */
export function clearBrandSemanticTokens(root: HTMLElement): void {
    for (const key of BRAND_TOKEN_KEYS) {
        root.style.removeProperty(key);
    }
}

export function clearPaletteFromRoot(root: HTMLElement, prefix: 'primary' | 'secondary'): void {
    for (const key of STEP_KEYS) {
        root.style.removeProperty(`--color-${prefix}-${key}`);
    }
}
