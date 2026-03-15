"use client"

import { useState, useCallback } from "react"
import DwellPieProgress from "@/components/dwell-pie-progress"

// 26 letters grouped into 7 groups of 4 (last group has only 2)
const LETTER_GROUPS = [
  ["q", "r", "s", "t"],
  ["a", "b", "c", "d"],
  ["e", "f", "g", "h"],
  ["i", "j", "k", "l"],
  ["m", "n", "o", "p"],
  ["u", "v", "w", "x"],
  ["y", "z"],
]

// Group positions arranged in a circular/flower pattern
const GROUP_POSITIONS = [
  { x: 0, y: -100 },      // top center
  { x: -85, y: -50 },     // top left
  { x: 85, y: -50 },      // top right
  { x: -100, y: 30 },     // middle left
  { x: 100, y: 30 },      // middle right
  { x: -50, y: 100 },     // bottom left
  { x: 50, y: 100 },      // bottom right
]

// Colors for individual letters in expanded state
const LETTER_COLORS = ["#3b82f6", "#ef4444", "#eab308", "#22c55e"]

// Punctuation marks
const PUNCTUATION_ROW = [":", "@", "#", "*", "&", "~", "%", "-", "+", "=", "\\", "/", ".", ",", "?", "!"]

interface EnglishKeyboardProps {
  onClose: () => void
  onSwitchLanguage?: () => void
}

export default function EnglishKeyboard({ onClose, onSwitchLanguage }: EnglishKeyboardProps) {
  const [text, setText] = useState("")
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)

  const handleChar = useCallback((c: string) => {
    setText((prev) => prev + c)
    setExpandedGroup(null)
  }, [])

  const handleSpace = useCallback(() => {
    setText((prev) => prev + " ")
    setExpandedGroup(null)
  }, [])

  const handleBackspace = useCallback(() => {
    setText((prev) => prev.slice(0, -1))
    setExpandedGroup(null)
  }, [])

  const handleEnter = useCallback(() => {
    setText((prev) => prev + "\n")
    setExpandedGroup(null)
  }, [])

  // When hovering a group, highlight it, then auto-expand after delay
  const handleGroupHover = useCallback((groupIndex: number) => {
    setHoveredGroup(groupIndex)
    setTimeout(() => {
      setExpandedGroup(groupIndex)
    }, 300)
  }, [])

  const handleGroupLeave = useCallback(() => {
    setHoveredGroup(null)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/40 backdrop-blur-sm">
      <div className="relative bg-[#f0f2f5] rounded-2xl shadow-2xl p-5 flex flex-col items-center gap-4" style={{ minWidth: 500 }}>
        {/* Close / Exit button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 text-[13px] font-medium text-[#0566FF] hover:text-[#0450cc] flex items-center gap-1 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {"나가기"}
        </button>

        {/* Language toggle */}
        <div className="flex gap-2 pt-6">
          <DwellPieProgress size={40} duration={1000} onDwellComplete={() => onSwitchLanguage?.()}>
            <button className="px-4 h-[36px] rounded-lg bg-[#0566FF] text-[#ffffff] text-[12px] font-bold flex items-center justify-center hover:bg-[#0450cc] transition-colors">
              {"한글"}
            </button>
          </DwellPieProgress>
        </div>

        {/* Text display area */}
        <div className="flex gap-2 w-full max-w-[420px]">
          <div className="flex-1 bg-[#ffffff] rounded-lg border border-[#d1d5db] p-3 min-h-[80px] max-h-[100px] overflow-auto shadow-inner">
            <p className="text-[16px] text-[#1a1a1a] font-medium whitespace-pre-wrap break-all leading-relaxed">
              {text || <span className="text-[#9ca3af]">{"Type here..."}</span>}
              <span className="inline-block w-[2px] h-[18px] bg-[#0566FF] animate-pulse ml-[1px] align-text-bottom" />
            </p>
          </div>
          {/* Del + Enter */}
          <div className="flex flex-col gap-1">
            <DwellPieProgress size={44} duration={1000} onDwellComplete={handleBackspace}>
              <button className="w-[50px] h-[44px] rounded-lg bg-[#ef4444] text-[#ffffff] text-[13px] font-bold flex items-center justify-center shadow-sm hover:bg-[#dc2626]">
                Del
              </button>
            </DwellPieProgress>
            <DwellPieProgress size={44} duration={1000} onDwellComplete={handleEnter}>
              <button className="w-[50px] h-[44px] rounded-lg bg-[#0566FF] text-[#ffffff] text-[13px] font-bold flex items-center justify-center shadow-sm hover:bg-[#0450cc]">
                Enter
              </button>
            </DwellPieProgress>
          </div>
        </div>

        {/* Circular letter groups */}
        <div className="relative bg-[#e8f0ff] rounded-xl" style={{ width: 300, height: 280 }}>
          {LETTER_GROUPS.map((group, gi) => {
            const pos = GROUP_POSITIONS[gi]
            const isHovered = hoveredGroup === gi
            const isExpanded = expandedGroup === gi

            return (
              <div
                key={gi}
                className="absolute"
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {!isExpanded ? (
                  /* Collapsed group - shows 4 letters in a small cluster */
                  <div
                    onMouseEnter={() => handleGroupHover(gi)}
                    onMouseLeave={handleGroupLeave}
                    className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer
                      ${isHovered 
                        ? "bg-[#0566FF] shadow-lg shadow-[#0566FF]/40 scale-125 ring-2 ring-[#0566FF]" 
                        : "bg-[#ffffff] shadow-sm hover:bg-[#f0f4ff]"
                      }`}
                  >
                    {/* Show letters in a 2x2 mini grid */}
                    <div className="grid grid-cols-2 gap-0.5">
                      {group.map((letter, li) => (
                        <span
                          key={li}
                          className={`text-[13px] font-semibold w-[18px] h-[18px] flex items-center justify-center rounded transition-colors
                            ${isHovered ? "text-[#ffffff]" : "text-[#1a1a1a]"}`}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Expanded group - shows 4 individual colored buttons with progress bars */
                  <div className="relative w-[100px] h-[100px]">
                    {group.map((letter, li) => {
                      const letterPositions = [
                        { x: 0, y: -30 },   // top
                        { x: -30, y: 0 },   // left
                        { x: 30, y: 0 },    // right
                        { x: 0, y: 30 },    // bottom
                      ]
                      const lpos = letterPositions[li] || { x: 0, y: 0 }
                      const color = LETTER_COLORS[li % LETTER_COLORS.length]

                      return (
                        <div
                          key={li}
                          className="absolute"
                          style={{
                            left: `calc(50% + ${lpos.x}px)`,
                            top: `calc(50% + ${lpos.y}px)`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <DwellPieProgress
                            size={38}
                            duration={1000}
                            onDwellComplete={() => handleChar(letter)}
                          >
                            <button
                              className="w-[34px] h-[34px] rounded-full text-[16px] font-bold text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                              style={{ backgroundColor: color }}
                            >
                              {letter}
                            </button>
                          </DwellPieProgress>
                        </div>
                      )
                    })}
                    {/* Center cancel button */}
                    <button
                      onClick={() => setExpandedGroup(null)}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[24px] h-[24px] rounded-full bg-[#9ca3af] text-white text-[11px] flex items-center justify-center hover:bg-[#6b7280] cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Space bar */}
        <DwellPieProgress size={34} duration={1000} onDwellComplete={handleSpace} className="w-full max-w-[420px]">
          <button className="w-full h-[34px] rounded-lg bg-[#ffffff] text-[#9ca3af] text-[12px] font-medium flex items-center justify-center shadow-sm hover:bg-[#e8f0ff]">
            SPACE
          </button>
        </DwellPieProgress>

        {/* Punctuation row - centered */}
        <div className="flex gap-1 flex-wrap justify-center">
          {PUNCTUATION_ROW.map((p) => (
            <DwellPieProgress key={p} size={30} duration={1000} onDwellComplete={() => handleChar(p)}>
              <button className="w-[30px] h-[30px] rounded-md bg-[#e5e7eb] text-[#1a1a1a] text-[14px] font-medium flex items-center justify-center shadow-sm hover:bg-[#d1d5db]">
                {p}
              </button>
            </DwellPieProgress>
          ))}
        </div>
      </div>
    </div>
  )
}
