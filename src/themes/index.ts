// Theme System Entry Point
// Add new themes here, set NEXT_PUBLIC_THEME env var to switch

import { tokens as nzoTokens } from './nine_zero_one/tokens'
import { content as nzoContent } from './nine_zero_one/content'

const themes = {
  nine_zero_one: { tokens: nzoTokens, content: nzoContent },
} as const

type ThemeName = keyof typeof themes

const THEME = (process.env.NEXT_PUBLIC_THEME || 'nine_zero_one') as ThemeName

const active = themes[THEME] ?? themes.nine_zero_one

export const themeTokens  = active.tokens
export const themeContent = active.content
export const themeName    = active.tokens.name
