/**
 * Korean IME composition engine using Unicode Hangul syllable formula.
 *
 * Hangul syllable = 0xAC00 + (cho * 21 + jung) * 28 + jong
 */

// Choseong (초성) – 19
export const CHOSEONG = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ",
  "ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
]

// Jungseong (중성) – 21
export const JUNGSEONG = [
  "ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ",
  "ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ",
]

// Jongseong (종성) – 28 (index 0 = no jongseong)
export const JONGSEONG = [
  "","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ",
  "ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ",
  "ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
]

// Maps a standalone jamo to choseong index (-1 if not choseong)
export function choIndex(c: string): number {
  return CHOSEONG.indexOf(c)
}

// Maps a vowel string to jungseong index (-1 if not jungseong)
export function jungIndex(v: string): number {
  return JUNGSEONG.indexOf(v)
}

// Maps a consonant to jongseong index (0 = none, -1 if not jongseong)
export function jongIndex(c: string): number {
  if (c === "") return 0
  return JONGSEONG.indexOf(c)
}

// Compose a hangul syllable character from indices
export function composeSyllable(cho: number, jung: number, jong: number = 0): string {
  if (cho < 0 || jung < 0) return ""
  const code = 0xac00 + (cho * 21 + jung) * 28 + jong
  return String.fromCharCode(code)
}

// Check if a consonant can be a jongseong
export function canBeJongseong(c: string): boolean {
  return JONGSEONG.indexOf(c) > 0
}

// Check if two jongseong consonants can combine (e.g., ㄱ+ㅅ=ㄳ)
const DOUBLE_JONG: Record<string, string> = {
  "ㄱㅅ": "ㄳ",
  "ㄴㅈ": "ㄵ",
  "ㄴㅎ": "ㄶ",
  "ㄹㄱ": "ㄺ",
  "ㄹㅁ": "ㄻ",
  "ㄹㅂ": "ㄼ",
  "ㄹㅅ": "ㄽ",
  "ㄹㅌ": "ㄾ",
  "ㄹㅍ": "ㄿ",
  "ㄹㅎ": "ㅀ",
  "ㅂㅅ": "ㅄ",
}

export function combineJongseong(a: string, b: string): string | null {
  return DOUBLE_JONG[a + b] || null
}

// Split a combined jongseong back into two consonants
const SPLIT_JONG: Record<string, [string, string]> = {
  ㄳ: ["ㄱ", "ㅅ"],
  ㄵ: ["ㄴ", "ㅈ"],
  ㄶ: ["ㄴ", "ㅎ"],
  ㄺ: ["ㄹ", "ㄱ"],
  ㄻ: ["ㄹ", "ㅁ"],
  ㄼ: ["ㄹ", "ㅂ"],
  ㄽ: ["ㄹ", "ㅅ"],
  ㄾ: ["ㄹ", "ㅌ"],
  ㄿ: ["ㄹ", "ㅍ"],
  ㅀ: ["ㄹ", "ㅎ"],
  ㅄ: ["ㅂ", "ㅅ"],
}

export function splitJongseong(j: string): [string, string] | null {
  return SPLIT_JONG[j] || null
}

/**
 * Vowel stroke resolver – 천지인 (Cheonjiin) style
 *
 * Stroke types: "dot" (ㆍ), "ddot" (ㆍㆍ), "h" (ㅡ), "v" (ㅣ)
 */
export type VowelStroke = "dot" | "ddot" | "h" | "v"

const VOWEL_MAP: Record<string, string> = {
  // Single
  h: "ㅡ",
  v: "ㅣ",
  // Two strokes
  "v,dot": "ㅏ",
  "v,ddot": "ㅑ",
  "dot,v": "ㅓ",
  "ddot,v": "ㅕ",
  "dot,h": "ㅗ",
  "ddot,h": "ㅛ",
  "h,dot": "ㅜ",
  "h,ddot": "ㅠ",
  // Three strokes
  "v,dot,v": "ㅐ",
  "v,ddot,v": "ㅒ",
  "dot,v,v": "ㅔ",
  "ddot,v,v": "ㅖ",
  "h,v": "ㅢ",
  // Complex (compound vowels)
  "dot,h,v,dot": "ㅘ",
  "dot,h,v,ddot": "ㅙ",
  "dot,h,v": "ㅚ",
  "h,dot,dot,v": "ㅝ",
  "h,dot,v": "ㅝ",
  "h,ddot,v": "ㅝ",
  "h,dot,dot,v,v": "ㅞ",
  "h,dot,v,v": "ㅟ",
}

export function resolveVowelStrokes(strokes: VowelStroke[]): string | null {
  const key = strokes.join(",")
  return VOWEL_MAP[key] || null
}

export function isConsonant(c: string): boolean {
  return choIndex(c) >= 0
}

export function isVowel(v: string): boolean {
  return jungIndex(v) >= 0
}

// Combined vowels that can be formed by adding a single vowel
const COMBINE_JUNG: Record<string, string> = {
  "ㅗㅏ": "ㅘ",
  "ㅗㅐ": "ㅙ",
  "ㅗㅣ": "ㅚ",
  "ㅜㅓ": "ㅝ",
  "ㅜㅔ": "ㅞ",
  "ㅜㅣ": "ㅟ",
  "ㅡㅣ": "ㅢ",
}

export function combineJungseong(a: string, b: string): string | null {
  return COMBINE_JUNG[a + b] || null
}

/**
 * IME State Machine
 */
export type IMEState =
  | { type: "EMPTY" }
  | { type: "CHO"; cho: number }
  | { type: "JUNG"; cho: number; jung: number }
  | { type: "JONG"; cho: number; jung: number; jong: number; jongChar: string }

export interface IMEResult {
  committed: string  // finalized text to add to buffer
  composing: string  // currently composing syllable (display in preview)
  state: IMEState
}

export function initialIMEState(): IMEState {
  return { type: "EMPTY" }
}

export function processConsonant(state: IMEState, consonant: string): IMEResult {
  const ci = choIndex(consonant)
  if (ci < 0) return { committed: consonant, composing: "", state: { type: "EMPTY" } }

  switch (state.type) {
    case "EMPTY":
      return {
        committed: "",
        composing: consonant,
        state: { type: "CHO", cho: ci },
      }

    case "CHO":
      // Commit the previous consonant as-is, start new
      return {
        committed: CHOSEONG[state.cho],
        composing: consonant,
        state: { type: "CHO", cho: ci },
      }

    case "JUNG": {
      // Try to add as jongseong
      const ji = jongIndex(consonant)
      if (ji > 0) {
        return {
          committed: "",
          composing: composeSyllable(state.cho, state.jung, ji),
          state: { type: "JONG", cho: state.cho, jung: state.jung, jong: ji, jongChar: consonant },
        }
      }
      // Can't be jongseong – commit current syllable, start new choseong
      return {
        committed: composeSyllable(state.cho, state.jung),
        composing: consonant,
        state: { type: "CHO", cho: ci },
      }
    }

    case "JONG": {
      // Try to combine double jongseong
      const combined = combineJongseong(state.jongChar, consonant)
      if (combined) {
        const combJi = jongIndex(combined)
        if (combJi > 0) {
          return {
            committed: "",
            composing: composeSyllable(state.cho, state.jung, combJi),
            state: { type: "JONG", cho: state.cho, jung: state.jung, jong: combJi, jongChar: combined },
          }
        }
      }
      // Commit current syllable, start new choseong
      return {
        committed: composeSyllable(state.cho, state.jung, state.jong),
        composing: consonant,
        state: { type: "CHO", cho: ci },
      }
    }
  }
}

export function processVowel(state: IMEState, vowel: string): IMEResult {
  const vi = jungIndex(vowel)
  if (vi < 0) return { committed: vowel, composing: "", state: { type: "EMPTY" } }

  switch (state.type) {
    case "EMPTY":
      // Standalone vowel
      return {
        committed: vowel,
        composing: "",
        state: { type: "EMPTY" },
      }

    case "CHO":
      return {
        committed: "",
        composing: composeSyllable(state.cho, vi),
        state: { type: "JUNG", cho: state.cho, jung: vi },
      }

    case "JUNG": {
      // Try compound vowel
      const combined = combineJungseong(JUNGSEONG[state.jung], vowel)
      if (combined) {
        const cvi = jungIndex(combined)
        if (cvi >= 0) {
          return {
            committed: "",
            composing: composeSyllable(state.cho, cvi),
            state: { type: "JUNG", cho: state.cho, jung: cvi },
          }
        }
      }
      // Commit current, standalone vowel
      return {
        committed: composeSyllable(state.cho, state.jung),
        composing: "",
        state: { type: "EMPTY" },
      }
    }

    case "JONG": {
      // Decompose: the jongseong moves to become next syllable's choseong
      const split = splitJongseong(state.jongChar)
      if (split) {
        // Double jongseong: first stays as jong, second becomes new cho
        const [first, second] = split
        const firstJi = jongIndex(first)
        const secondCi = choIndex(second)
        return {
          committed: composeSyllable(state.cho, state.jung, firstJi),
          composing: composeSyllable(secondCi, vi),
          state: { type: "JUNG", cho: secondCi, jung: vi },
        }
      } else {
        // Single jongseong: remove from current, use as next cho
        const newCi = choIndex(state.jongChar)
        return {
          committed: composeSyllable(state.cho, state.jung),
          composing: composeSyllable(newCi, vi),
          state: { type: "JUNG", cho: newCi, jung: vi },
        }
      }
    }
  }
}

export function commitState(state: IMEState): string {
  switch (state.type) {
    case "EMPTY":
      return ""
    case "CHO":
      return CHOSEONG[state.cho]
    case "JUNG":
      return composeSyllable(state.cho, state.jung)
    case "JONG":
      return composeSyllable(state.cho, state.jung, state.jong)
  }
}
