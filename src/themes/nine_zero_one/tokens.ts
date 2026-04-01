// Vasanthi Salon Theme Tokens
// Warm earth palette — #EFEBE2 / #EFE4D7 / #B9A594 / #302621

export const tokens = {
  vars: {
    // ── Backgrounds ──
    '--t-bg':        '#EFEBE2',   // Primary: lightest warm cream
    '--t-bg-2':      '#EFE4D7',   // Alternate sections: warm beige
    '--t-bg-3':      '#EFEBE2',   // Cards, forms: lightest
    '--t-bg-dark':   '#302621',   // Dark panels (hero overlay bg etc.)

    // ── Text ──
    '--t-text':      '#302621',   // Primary text: darkest brown
    '--t-text-2':    '#6B5A4E',   // Secondary text: mid brown
    '--t-text-3':    '#B9A594',   // Muted / placeholders: warm taupe

    // ── Accents ──
    '--t-accent':    '#B9A594',   // Warm taupe
    '--t-accent-2':  '#B9A594',   // Warm taupe

    // ── Borders ──
    '--t-border':    'rgba(48, 38, 33, 0.10)',
    '--t-border-2':  'rgba(48, 38, 33, 0.25)',

    // ── Shape: sharp everywhere ──
    '--t-radius':    '0px',

    // ── Typography ──
    '--t-font-display': 'var(--font-display), Georgia, "Times New Roman", serif',
    '--t-font-body':    'var(--font-body), "Montserrat", "Helvetica Neue", sans-serif',
  },
  name: 'nine_zero_one' as const,
}
