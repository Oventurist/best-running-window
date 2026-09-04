/** Tailwind build config (audit 3.2) — carries the theme that previously lived
 * in the inline `tailwind.config` block of index.html. The Tailwind CDN runtime
 * is gone; `npm run build:css` emits the static css/tailwind.css.
 * darkMode config intentionally DROPPED (audit 5.5 decision: no dark mode). */
export default {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        'on-surface-variant': '#45464d',
        'tertiary': '#000000',
        'outline-variant': '#c6c6cd',
        'primary-fixed': '#dae2fd',
        'inverse-primary': '#bec6e0',
        'surface': '#f7f9fb',
        'primary-container': '#131b2e',
        'secondary-fixed': '#6ffbbe',
        'surface-bright': '#f7f9fb',
        'on-primary-fixed-variant': '#3f465c',
        'surface-glass': 'rgba(255, 255, 255, 0.8)',
        'tertiary-container': '#0b1c30',
        'vibrant-mint': '#2DD4BF',
        'on-surface': '#191c1e',
        'error': '#ba1a1a',
        'on-secondary-fixed-variant': '#005236',
        'on-tertiary-fixed': '#0b1c30',
        'inverse-on-surface': '#eff1f3',
        'surface-container-lowest': '#ffffff',
        'on-tertiary': '#ffffff',
        'on-primary': '#ffffff',
        'inverse-surface': '#2d3133',
        'surface-container': '#eceef0',
        'on-secondary-container': '#00714d',
        'on-tertiary-fixed-variant': '#38485d',
        'surface-container-highest': '#e0e3e5',
        'primary-fixed-dim': '#bec6e0',
        'surface-container-high': '#e6e8ea',
        'error-container': '#ffdad6',
        'surface-variant': '#e0e3e5',
        'secondary-fixed-dim': '#4edea3',
        'surface-dim': '#d8dadc',
        'surface-container-low': '#f2f4f6',
        'primary': '#000000',
        'on-tertiary-container': '#75859d',
        'on-error-container': '#93000a',
        'on-background': '#191c1e',
        'secondary-container': '#6cf8bb',
        'midnight-deep': '#020617',
        'surface-tint': '#565e74',
        'cool-gray-100': '#F1F5F9',
        'tertiary-fixed-dim': '#b7c8e1',
        'on-secondary-fixed': '#002113',
        'secondary': '#006c49',
        'on-primary-container': '#7c839b',
        'on-secondary': '#ffffff',
        'background': '#f7f9fb',
        'tertiary-fixed': '#d3e4fe',
        'on-primary-fixed': '#131b2e',
        'on-error': '#ffffff',
        'cool-gray-900': '#1E293B',
        'outline': '#76777d'
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        gutter: '24px',
        'margin-desktop': '48px',
        'stack-lg': '40px',
        'stack-md': '24px',
        'margin-mobile': '16px',
        'stack-sm': '12px',
        'container-max': '1200px',
        base: '8px'
      },
      fontFamily: {
        'headline-md': ['Montserrat'],
        'headline-lg': ['Montserrat'],
        'label-bold': ['Inter'],
        'body-lg': ['Inter'],
        'label-sm': ['Inter'],
        'headline-lg-mobile': ['Montserrat'],
        'display-lg': ['Montserrat'],
        'body-md': ['Inter']
      },
      fontSize: {
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'label-bold': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }]
      }
    }
  },
  plugins: []
};
