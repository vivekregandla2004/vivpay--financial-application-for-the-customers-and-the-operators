/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VivPay Sky Glass Design System Tokens
 * Unified design token architecture combining:
 * 1. Glassmorphism (navigation, heroes, modal backdrops, overlays)
 * 2. Bento Grid (dashboard modularity & visual hierarchy)
 * 3. Flat Design 2.0 (transaction ledger, statements, forms)
 * 4. Restrained Neumorphism (secondary controls, segmented toggles)
 */

export const SKY_GLASS_TOKENS = {
  colors: {
    canvas: '#F4F9FF',
    surface: '#FFFFFF',
    primary: '#5878FF',
    primaryHover: '#4665E8',
    primaryActive: '#3653D8',
    primaryText: '#172B4D',
    secondaryText: '#64748B',
    mutedText: '#94A3B8',
    paleBlue: '#EAF3FF',
    paleBlueHover: '#DFECFF',
    lavenderAccent: '#EDE9FF',
    lavenderHover: '#E3DCFF',
    borderLight: '#DCE7F6',
    borderGlass: 'rgba(88, 120, 255, 0.14)',
    borderFocus: '#5878FF',
    semantic: {
      success: '#10B981',
      successLight: '#ECFDF5',
      successBorder: '#A7F3D0',
      warning: '#F59E0B',
      warningLight: '#FFFBEB',
      warningBorder: '#FDE68A',
      error: '#EF4444',
      errorLight: '#FEF2F2',
      errorBorder: '#FECACA',
      info: '#3B82F6',
      infoLight: '#EFF6FF',
      infoBorder: '#BFDBFE',
    },
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.78)',
    backgroundSubtle: 'rgba(234, 243, 255, 0.65)',
    backgroundCard: 'rgba(255, 255, 255, 0.88)',
    blur: 'backdrop-blur-md',
    blurHeavy: 'backdrop-blur-xl',
    border: '1px solid rgba(88, 120, 255, 0.14)',
    shadow: '0 8px 32px 0 rgba(88, 120, 255, 0.08)',
    shadowFloat: '0 20px 40px -10px rgba(88, 120, 255, 0.16)',
  },
  neumorphism: {
    subtle: '2px 2px 6px rgba(88, 120, 255, 0.08), -2px -2px 6px #FFFFFF',
    inset: 'inset 1px 1px 3px rgba(88, 120, 255, 0.12), inset -1px -1px 3px #FFFFFF',
    pill: '3px 3px 8px rgba(88, 120, 255, 0.07), -3px -3px 8px #FFFFFF',
  },
  radii: {
    sm: '0.5rem', // 8px
    md: '0.75rem', // 12px
    lg: '1rem', // 16px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },
} as const;

export type SkyGlassTokens = typeof SKY_GLASS_TOKENS;
