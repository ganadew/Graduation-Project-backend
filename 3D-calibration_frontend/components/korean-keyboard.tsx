"use client"

import { useState, useCallback, useRef } from "react"
import {
  CHOSEONG,
  processConsonant,
  processVowel,
  commitState,
  initialIMEState,
  resolveVowelStrokes,
  type IMEState,
  type VowelStroke,
} from "@/lib/korean-ime"
import DwellPieProgress from "@/components/dwell-pie-progress"

// Consonant grid layout matching image 2
const CONSONANT_ROWS = [
  ["ㄲ", "ㄹ", "ㄸ"],
  ["ㅋ", "ㄱ", "ㄴ", "ㄷ", "ㅌ"],
  ["ㅎ", "ㅇ", null, "ㅁ"],
  ["ㅊ", "ㅈ", "ㅅ", "ㅂ", "ㅍ"],
  ["ㅉ", "ㅆ", "ㅃ"],
]

const NUMBER_ROWS = [
  ["1", "2", "3", "4", "5"],
  ["6", "7", "8", "9", "0"],
]

// Punctuation marks
const PUNCTUATION_ROW = [":", "@", "#", "*", "&", "~", "%", "-", "+", "=", "\\", "/", ".", ",", "?", "!"]

// Vowel helpers for 천지인 style
type VowelHelper = { label: string; stroke: VowelStroke; position: "top" | "bottom" | "left" | "right" }
const VOWEL_HELPERS: VowelHelper[] = [
  { label: "\u2015", stroke: "h", position: "top" },       // ㅡ horizontal
  { label: "\uFF5C", stroke: "v", position: "bottom" },    // ㅣ vertical
  { label: "\u00B7", stroke: "dot", position: "left" },     // ㆍ single dot
  { label: "\u00B7\u00B7", stroke: "ddot", position: "right" }, // ㆍㆍ double dot
]

interface KoreanKeyboardProps {
  typedText: string
  setTypedText: (text: string) => void
  onSwitchLanguage?: () => void
  gaze?: { x: number; y: number } | null
}

export default function KoreanKeyboard({ typedText, setTypedText, onSwitchLanguage, gaze }: KoreanKeyboardProps) {
  const [composing, setComposing] = useState("")
  const [imeState, setImeState] = useState<IMEState>(initialIMEState())

  // Vowel helper state
  const [activeConsonantKey, setActiveConsonantKey] = useState<string | null>(null)
  const [activeKeyPos, setActiveKeyPos] = useState<{ x: number; y: number } | null>(null)
  const [vowelStrokes, setVowelStrokes] = useState<VowelStroke[]>([])

  const consonantGridRef = useRef<HTMLDivElement>(null)

  // Process a consonant input
  const handleConsonant = useCallback((c: string, keyElement?: HTMLElement) => {
    // If vowel helpers are active, commit any pending vowel first
    if (activeConsonantKey && vowelStrokes.length > 0) {
      const resolved = resolveVowelStrokes(vowelStrokes)
      if (resolved) {
        const result = processVowel(imeState, resolved)
        const newText = typedText + result.committed
        setTypedText(newText)
        setComposing(result.composing)
        setImeState(result.state)
        // Now process the new consonant
        const result2 = processConsonant(result.state, c)
        setTypedText(newText + result2.committed)
        setComposing(result2.composing)
        setImeState(result2.state)
        setVowelStrokes([])
        setActiveConsonantKey(c)
        if (keyElement) {
          const rect = keyElement.getBoundingClientRect()
          setActiveKeyPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        }
        return
      }
    }

    const result = processConsonant(imeState, c)
    setTypedText(typedText + result.committed)
    setComposing(result.composing)
    setImeState(result.state)

    // Show vowel helpers around this key
    setActiveConsonantKey(c)
    setVowelStrokes([])
    if (keyElement) {
      const rect = keyElement.getBoundingClientRect()
      setActiveKeyPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
  }, [imeState, typedText, setTypedText, activeConsonantKey, vowelStrokes])

  // Process a vowel stroke from helper
  const handleVowelStroke = useCallback((stroke: VowelStroke) => {
    const newStrokes = [...vowelStrokes, stroke]
    setVowelStrokes(newStrokes)

    const resolved = resolveVowelStrokes(newStrokes)
    if (resolved) {
      const result = processVowel(imeState, resolved)
      setTypedText(typedText + result.committed)
      setComposing(result.composing)
      setImeState(result.state)
      setVowelStrokes([])
      setActiveConsonantKey(null)
      setActiveKeyPos(null)
    }
  }, [vowelStrokes, imeState, typedText, setTypedText])

  // Direct vowel input (from vowel panel)
  const handleDirectVowel = useCallback((v: string) => {
    if (activeConsonantKey) {
      setActiveConsonantKey(null)
      setActiveKeyPos(null)
      setVowelStrokes([])
    }
    const result = processVowel(imeState, v)
    setTypedText(typedText + result.committed)
    setComposing(result.composing)
    setImeState(result.state)
  }, [imeState, activeConsonantKey, typedText, setTypedText])

  // Number / special char input
  const handleChar = useCallback((c: string) => {
    const committed = commitState(imeState)
    setTypedText(typedText + committed + c)
    setComposing("")
    setImeState(initialIMEState())
    setActiveConsonantKey(null)
    setActiveKeyPos(null)
    setVowelStrokes([])
  }, [imeState, typedText, setTypedText])

  // Backspace
  const handleDelete = useCallback(() => {
    if (composing.length > 0) {
      setComposing("")
      setImeState(initialIMEState())
      setActiveConsonantKey(null)
      setActiveKeyPos(null)
      setVowelStrokes([])
    } else if (typedText.length > 0) {
      setTypedText(typedText.slice(0, -1))
    }
  }, [composing, typedText, setTypedText])

  // Space
  const handleSpace = useCallback(() => {
    const committed = commitState(imeState)
    setTypedText(typedText + committed + " ")
    setComposing("")
    setImeState(initialIMEState())
    setActiveConsonantKey(null)
    setActiveKeyPos(null)
    setVowelStrokes([])
  }, [imeState, typedText, setTypedText])

  // Enter
  const handleEnter = useCallback(() => {
    const committed = commitState(imeState)
    setTypedText(typedText + committed + "\n")
    setComposing("")
    setImeState(initialIMEState())
    setActiveConsonantKey(null)
    setActiveKeyPos(null)
    setVowelStrokes([])
  }, [imeState, typedText, setTypedText])

  const displayText = typedText + composing

  return (
    <div className="relative bg-[#f0f2f5] rounded-2xl shadow-2xl p-6 flex gap-5" style={{ minWidth: 620 }}>
      {/* LEFT: Consonant Grid */}
      <div className="flex flex-col items-center gap-1.5 pt-6" ref={consonantGridRef}>
        {CONSONANT_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1.5 justify-center">
            {row.map((key, ki) => {
              if (key === null) {
                return <div key={ki} className="w-[60px] h-[60px]" />
              }
              const isActive = activeConsonantKey === key
              return (
                <div key={ki} className="relative">
                  <DwellPieProgress gaze={gaze}
                    size={60}
                    duration={2000}
                    onDwellComplete={() => {
                      const el = consonantGridRef.current?.querySelector(`[data-key="${key}"]`) as HTMLElement | undefined
                      handleConsonant(key, el || undefined)
                    }}
                  >
                    <button
                      data-key={key}
                      className={`w-[60px] h-[60px] rounded-xl font-bold text-[20px] flex items-center justify-center transition-all
                        ${isActive
                          ? "bg-[#0566FF] text-[#ffffff] shadow-md"
                          : "bg-[#ffffff] text-[#1a1a1a] shadow-sm hover:bg-[#e8f0ff]"
                        }`}
                    >
                      {key}
                    </button>
                  </DwellPieProgress>

                  {/* Vowel helpers around active consonant */}
                  {isActive && activeKeyPos && (
                    <VowelHelperOverlay
                      gaze={gaze}
                      onStroke={handleVowelStroke}
                      strokes={vowelStrokes}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* RIGHT: Numbers + Text + Controls + Vowels */}
      <div className="flex flex-col gap-3 pt-6 flex-1">
        {/* Top row: Han/Eng toggle + Numbers */}
        <div className="flex flex-col gap-1 items-center">
          <div className="flex gap-1 items-center">
            <DwellPieProgress gaze={gaze} size={36} duration={2000} onDwellComplete={() => onSwitchLanguage?.()}>
              <button className="w-[36px] h-[36px] rounded-lg bg-[#0566FF] text-[#ffffff] text-[10px] font-bold flex items-center justify-center shadow-sm hover:bg-[#0450cc]">
                {"한영"}
              </button>
            </DwellPieProgress>
            {NUMBER_ROWS[0].map((n) => (
              <DwellPieProgress gaze={gaze} key={n} size={36} duration={2000} onDwellComplete={() => handleChar(n)}>
                <button className="w-[36px] h-[36px] rounded-lg bg-[#ffffff] text-[#1a1a1a] text-[16px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
                  {n}
                </button>
              </DwellPieProgress>
            ))}
          </div>
          <div className="flex gap-1 justify-center">
            {NUMBER_ROWS[1].map((n) => (
              <DwellPieProgress gaze={gaze} key={n} size={36} duration={2000} onDwellComplete={() => handleChar(n)}>
                <button className="w-[36px] h-[36px] rounded-lg bg-[#ffffff] text-[#1a1a1a] text-[16px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
                  {n}
                </button>
              </DwellPieProgress>
            ))}
          </div>
        </div>

        {/* Text display area */}
        <div className="flex gap-2">
          <div className="flex-1 bg-[#ffffff] rounded-lg border border-[#d1d5db] p-3 min-h-[90px] max-h-[120px] overflow-auto shadow-inner">
            <p className="text-[15px] text-[#1a1a1a] font-medium whitespace-pre-wrap break-all leading-relaxed">
              {displayText || <span className="text-[#9ca3af]">{"여기에 입력됩니다..."}</span>}
              <span className="inline-block w-[2px] h-[16px] bg-[#0566FF] animate-pulse ml-[1px] align-text-bottom" />
            </p>
          </div>
          {/* Del + Enter */}
          <div className="flex flex-col gap-1.5">
            <DwellPieProgress gaze={gaze} size={34} duration={2000} onDwellComplete={handleDelete}>
              <button className="w-[52px] h-[40px] rounded-lg bg-[#ef4444] text-[#ffffff] text-[12px] font-bold flex items-center justify-center shadow-sm hover:bg-[#dc2626]">
                Del
              </button>
            </DwellPieProgress>
            <DwellPieProgress gaze={gaze} size={34} duration={2000} onDwellComplete={handleEnter}>
              <button className="w-[52px] h-[40px] rounded-lg bg-[#0566FF] text-[#ffffff] text-[12px] font-bold flex items-center justify-center shadow-sm hover:bg-[#0450cc]">
                Enter
              </button>
            </DwellPieProgress>
          </div>
        </div>

        {/* Space bar */}
        <DwellPieProgress gaze={gaze} size={36} duration={2000} onDwellComplete={handleSpace} className="w-full">
          <button className="w-full h-[38px] rounded-lg bg-[#ffffff] text-[#9ca3af] text-[13px] font-medium flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
            {"스페이스"}
          </button>
        </DwellPieProgress>

        {/* Punctuation row */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {PUNCTUATION_ROW.map((p) => (
            <DwellPieProgress gaze={gaze} key={p} size={30} duration={2000} onDwellComplete={() => handleChar(p)}>
              <button className="w-[30px] h-[30px] rounded-md bg-[#e5e7eb] text-[#1a1a1a] text-[13px] font-medium flex items-center justify-center shadow-sm hover:bg-[#d1d5db]">
                {p}
              </button>
            </DwellPieProgress>
          ))}
        </div>

        {/* Vowel keys */}
        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5 justify-center">
            {["ㅏ","ㅓ","ㅗ","ㅜ","ㅡ"].map((v) => (
              <DwellPieProgress gaze={gaze} key={v} size={42} duration={2000} onDwellComplete={() => handleDirectVowel(v)}>
                <button className="w-[42px] h-[42px] rounded-lg bg-[#ffffff] text-[#1a1a1a] text-[18px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
                  {v}
                </button>
              </DwellPieProgress>
            ))}
          </div>
          <div className="flex gap-1.5 justify-center">
            {["ㅑ","ㅕ","ㅛ","ㅠ","ㅣ"].map((v) => (
              <DwellPieProgress gaze={gaze} key={v} size={42} duration={2000} onDwellComplete={() => handleDirectVowel(v)}>
                <button className="w-[42px] h-[42px] rounded-lg bg-[#ffffff] text-[#1a1a1a] text-[18px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
                  {v}
                </button>
              </DwellPieProgress>
            ))}
          </div>
          <div className="flex gap-1.5 justify-center">
            {["ㅐ","ㅔ","ㅘ","ㅙ","ㅢ"].map((v) => (
              <DwellPieProgress gaze={gaze} key={v} size={42} duration={2000} onDwellComplete={() => handleDirectVowel(v)}>
                <button className="w-[42px] h-[42px] rounded-lg bg-[#ffffff] text-[#1a1a1a] text-[16px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
                  {v}
                </button>
              </DwellPieProgress>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Vowel helper overlay – 4 circles around the active consonant key
 */
function VowelHelperOverlay({
  gaze,
  onStroke,
  strokes,
}: {
  gaze?: { x: number; y: number } | null
  onStroke: (s: VowelStroke) => void
  strokes: VowelStroke[]
}) {
  const positions: Record<string, { top: string; left: string; transform: string }> = {
    top:    { top: "-38px", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left:   { top: "50%", left: "-38px", transform: "translateY(-50%)" },
    right:  { top: "50%", left: "calc(100% + 8px)", transform: "translateY(-50%)" },
  }

  return (
    <>
      {VOWEL_HELPERS.map((helper) => {
        const pos = positions[helper.position]
        const isUsed = strokes.includes(helper.stroke)
        return (
          <div
            key={helper.position}
            className="absolute z-20"
            style={{ top: pos.top, left: pos.left, transform: pos.transform }}
          >
            <DwellPieProgress gaze={gaze}
              size={30}
              duration={2000}
              onDwellComplete={() => onStroke(helper.stroke)}
            >
              <button
                className={`w-[30px] h-[30px] rounded-full border-2 border-dashed flex items-center justify-center text-[13px] font-bold transition-all
                  ${isUsed
                    ? "border-[#0566FF] bg-[#e8f0ff] text-[#0566FF]"
                    : "border-[#9ca3af] bg-[#ffffff] text-[#1a1a1a] hover:border-[#0566FF]"
                  }`}
              >
                {helper.label}
              </button>
            </DwellPieProgress>
          </div>
        )
      })}
    </>
  )
}
