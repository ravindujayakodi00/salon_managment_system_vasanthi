import { generatePalette, hexToRgb } from '@/lib/color-palette';

describe('color-palette', () => {
    it('hexToRgb parses 6-char hex', () => {
        expect(hexToRgb('#4B5945')).toEqual({ r: 75, g: 89, b: 69 });
    });

    it('generatePalette returns 11 shades', () => {
        const p = generatePalette('#4B5945');
        expect(Object.keys(p)).toHaveLength(11);
        expect(p['600']).toMatch(/^#[0-9a-f]{6}$/i);
    });
});
