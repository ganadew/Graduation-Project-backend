"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DwellPieProgress from "@/components/dwell-pie-progress"
import KoreanKeyboard from "@/components/korean-keyboard"
import GazePointerDispatcher from "@/components/gaze-pointer-dispatcher"
import GazeCursor from "@/components/gaze-cursor"
import WebcamPreview from "@/components/webcam-preview"
import GazeDwellButton from "@/components/gaze-dwell-button"
import DrumPage from "@/components/calibration-pages/drum-page"
import MolePage from "@/components/calibration-pages/mole-page"
import SnackPage from "@/components/calibration-pages/snack-page"
import { useGazeTracking } from "@/hooks/use-gaze-tracking"

const PAGES = [
  { id: 1, title: "드럼 연주", description: "파란 원을 따라 연주하세요." },
  { id: 2, title: "두더지 잡기", description: "튀어나오는 두더지를 따라가세요." },
  { id: 3, title: "과자봉지 뜯기", description: "파란 원을 따라 절취선을 따라가세요." },
  { id: 4, title: "가상 키보드 연습", description: "가상 키보드를 연습하세요." },
]

export default function CalibrationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [typedText, setTypedText] = useState("")
  const [isKorean, setIsKorean] = useState(true)
  const {
    gaze,
    isConnected,
    connectionError,
    webcamFrame,
    sendCalibrationSamples,
  } = useGazeTracking()

  const handleSwitchLanguage = () => {
    setIsKorean(!isKorean)
  }

  const useGazeAsCursor = isConnected && !!gaze

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.cursor = useGazeAsCursor ? "none" : ""
    return () => {
      document.body.style.cursor = ""
    }
  }, [useGazeAsCursor])

  const goToPrevious = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const goToNext = () => {
    if (currentStep < PAGES.length - 1) setCurrentStep((s) => s + 1)
  }

  const progressPercent = (currentStep / (PAGES.length - 1)) * 100

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-white"
      style={{ cursor: useGazeAsCursor ? "none" : undefined }}
    >
      <GazePointerDispatcher gaze={gaze} />
      <GazeCursor gaze={gaze} visible={useGazeAsCursor} />

      {/* 웹캠 - 오른쪽 상단 */}
      <WebcamPreview
        frameData={webcamFrame}
        isConnected={isConnected}
        connectionError={connectionError}
      />

      {currentStep === 0 && (
        <DrumPage
          gaze={gaze}
          onSendSamples={sendCalibrationSamples}
          onNext={goToNext}
          onPrevious={goToPrevious}
          progress={progressPercent}
        />
      )}
      {currentStep === 1 && (
        <MolePage
          gaze={gaze}
          onSendSamples={sendCalibrationSamples}
          onNext={goToNext}
          onPrevious={goToPrevious}
          progress={progressPercent}
        />
      )}
      {currentStep === 2 && (
        <SnackPage
          gaze={gaze}
          onSendSamples={sendCalibrationSamples}
          onNext={goToNext}
          onPrevious={goToPrevious}
          progress={progressPercent}
        />
      )}

      {currentStep === 3 && (
        <>
          <main className="relative pt-24 pb-32 px-8 lg:pr-[360px] min-h-screen flex flex-col">
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
              <h1 className="text-2xl font-bold text-[#333] mb-1">{PAGES[currentStep].title}</h1>
              <p className="text-sm text-[#666] mb-8">{PAGES[currentStep].description}</p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-12 flex-1">
                <CrystalComputer typedText={typedText} />
                <div className="flex flex-col items-center">
                  <span className="text-[#666] text-sm font-medium mb-2">
                    {isKorean ? "한글 키보드" : "영어 키보드"}
                  </span>
                  {isKorean ? (
                    <KoreanKeyboard
                      typedText={typedText}
                      setTypedText={setTypedText}
                      onSwitchLanguage={handleSwitchLanguage}
                      gaze={gaze}
                    />
                  ) : (
                    <EnglishKeyboard
                      typedText={typedText}
                      setTypedText={setTypedText}
                      onSwitchLanguage={handleSwitchLanguage}
                      gaze={gaze}
                    />
                  )}
                </div>
              </div>
            </div>
          </main>

          <div className="fixed bottom-8 right-8 flex items-center gap-3 z-20">
            <GazeDwellButton gaze={gaze} onDwellComplete={currentStep > 0 ? goToPrevious : () => {}}>
              <button
                onClick={goToPrevious}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-base font-semibold transition-all ${
                  currentStep === 0 ? "text-[#ccc] cursor-not-allowed" : "text-[#0566FF] hover:bg-[#0566FF]/10"
                }`}
              >
                <ChevronLeft className="w-6 h-6" />
                이전
              </button>
            </GazeDwellButton>
            <GazeDwellButton
              gaze={gaze}
              onDwellComplete={currentStep < PAGES.length - 1 ? goToNext : () => {}}
            >
              <button
                onClick={goToNext}
                disabled={currentStep === PAGES.length - 1}
                className={`flex items-center gap-2 px-7 py-3 rounded-2xl text-base font-semibold transition-all ${
                  currentStep === PAGES.length - 1
                    ? "bg-[#0566FF]/30 text-white/60 cursor-not-allowed"
                    : "bg-[#0566FF] text-white hover:bg-[#0452cc] shadow-lg"
                }`}
              >
                다음
                <ChevronRight className="w-6 h-6" />
              </button>
            </GazeDwellButton>
          </div>
        </>
      )}
    </div>
  )
}

// Crystal Computer Component
function CrystalComputer({ typedText }: { typedText: string }) {
  return (
    <div className="relative" style={{ width: 400, height: 350 }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div
          className="relative rounded-[24px] p-3"
          style={{
            width: 280,
            height: 200,
            background: "linear-gradient(145deg, #e8f4fc, #d4ebf7)",
            boxShadow: "0 8px 24px rgba(5,102,255,0.15)",
            border: "2px solid rgba(5,102,255,0.2)",
          }}
        >
          <div
            className="w-full h-full rounded-[16px] p-4 overflow-auto"
            style={{
              background: "linear-gradient(135deg, #5a6a8a 0%, #4a5a7a 100%)",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <p className="text-white/90 text-sm font-medium whitespace-pre-wrap break-all leading-relaxed">
              {typedText}
              <span className="inline-block w-[2px] h-[16px] bg-[#0566FF] animate-pulse ml-[1px] align-text-bottom" />
            </p>
          </div>
        </div>
        <div
          className="mx-auto mt-1 w-[60px] h-5 rounded-b-lg"
          style={{ background: "linear-gradient(180deg, #d4ebf7, #c0e0f0)" }}
        />
        <div
          className="mx-auto w-20 h-3 rounded-b-lg"
          style={{ background: "linear-gradient(180deg, #c0e0f0, #a8d4e8)" }}
        />
      </div>
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[180px] h-14 rounded-xl p-2"
        style={{
          background: "linear-gradient(145deg, #e8f4fc, #d4ebf7)",
          boxShadow: "0 4px 12px rgba(5,102,255,0.1)",
          border: "1px solid rgba(5,102,255,0.2)",
        }}
      >
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="rounded w-4 h-3"
              style={{ background: "rgba(5,102,255,0.1)" }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// English Keyboard
const LETTER_GROUPS = [
  ["q", "r", "s", "t"],
  ["a", "b", "c", "d"],
  ["e", "f", "g", "h"],
  ["i", "j", "k", "l"],
  ["m", "n", "o", "p"],
  ["u", "v", "w", "x"],
  ["y", "z"],
]
const PUNCTUATION_ROW = [":", "@", "#", "*", "&", "~", "%", "-", "+", "=", "\\", "/", ".", ",", "?", "!"]

function LetterGroupCircle({
  group,
  groupIndex,
  hoveredGroup,
  expandedGroup,
  onHover,
  onLeave,
  onChar,
  onClose,
  gaze,
}: {
  group: string[]
  groupIndex: number
  hoveredGroup: number | null
  expandedGroup: number | null
  onHover: (index: number) => void
  onLeave: () => void
  onChar: (char: string) => void
  onClose: () => void
  gaze?: { x: number; y: number } | null
}) {
  const isHovered = hoveredGroup === groupIndex
  const isExpanded = expandedGroup === groupIndex
  const letterColors = ["#0566FF", "#ef4444", "#eab308", "#22c55e"]

  if (isExpanded) {
    return (
      <div className="relative w-[90px] h-[90px]">
        {group.map((letter, li) => {
          const lpos = [
            { x: 0, y: -26 },
            { x: -26, y: 0 },
            { x: 26, y: 0 },
            { x: 0, y: 26 },
          ][li] || { x: 0, y: 0 }
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
              <DwellPieProgress gaze={gaze} size={32} duration={2000} onDwellComplete={() => onChar(letter)}>
                <button
                  className="w-[30px] h-[30px] rounded-full text-sm font-bold text-white shadow-lg"
                  style={{ backgroundColor: letterColors[li % letterColors.length] }}
                >
                  {letter}
                </button>
              </DwellPieProgress>
            </div>
          )
        })}
        <button
          onClick={onClose}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#9ca3af] text-white text-[10px] flex items-center justify-center hover:bg-[#6b7280]"
        >
          X
        </button>
      </div>
    )
  }

  return (
    <DwellPieProgress
      gaze={gaze}
      size={70}
      duration={2000}
      onDwellComplete={() => onHover(groupIndex)}
    >
      <div
        onMouseEnter={() => onHover(groupIndex)}
        onMouseLeave={onLeave}
        className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all cursor-pointer ${
          isHovered ? "bg-[#0566FF] text-white shadow-lg scale-110" : "bg-white text-[#333] shadow-md hover:bg-[#f0f4ff]"
        }`}
      >
        <div className="grid grid-cols-2 gap-0.5">
          {group.map((letter, li) => (
            <span key={li} className="text-xs font-semibold w-[18px] h-[18px] flex items-center justify-center">
              {letter}
            </span>
          ))}
        </div>
      </div>
    </DwellPieProgress>
  )
}

function EnglishKeyboard({
  typedText,
  setTypedText,
  onSwitchLanguage,
  gaze,
}: {
  typedText: string
  setTypedText: (text: string) => void
  onSwitchLanguage?: () => void
  gaze?: { x: number; y: number } | null
}) {
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null)

  const handleChar = useCallback((c: string) => {
    setTypedText(typedText + c)
    setExpandedGroup(null)
  }, [typedText, setTypedText])

  const handleSpace = useCallback(() => {
    setTypedText(typedText + " ")
    setExpandedGroup(null)
  }, [typedText, setTypedText])

  const handleBackspace = useCallback(() => {
    setTypedText(typedText.slice(0, -1))
    setExpandedGroup(null)
  }, [typedText, setTypedText])

  const handleEnter = useCallback(() => {
    setTypedText(typedText + "\n")
    setExpandedGroup(null)
  }, [typedText, setTypedText])

  const handleGroupHover = useCallback((groupIndex: number) => {
    setHoveredGroup(groupIndex)
    setTimeout(() => setExpandedGroup(groupIndex), 300)
  }, [])

  return (
    <div className="bg-[#f8f9fa] rounded-2xl shadow-xl p-4 flex flex-col items-center gap-3 w-[420px]">
      <DwellPieProgress gaze={gaze} size={40} duration={2000} onDwellComplete={() => onSwitchLanguage?.()}>
        <button className="px-5 py-1.5 rounded-lg bg-[#0566FF] text-white text-sm font-bold">
          한글
        </button>
      </DwellPieProgress>
      <div className="flex gap-2 w-full">
        <div className="flex-1 bg-white rounded-xl border-2 border-[#e5e7eb] p-3 min-h-[80px] max-h-[100px] overflow-auto">
          <p className="text-sm text-[#333] font-medium whitespace-pre-wrap break-all">
            {typedText || <span className="text-[#9ca3af]">Type here...</span>}
            <span className="inline-block w-[2px] h-4 bg-[#0566FF] animate-pulse ml-0.5 align-text-bottom" />
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <DwellPieProgress gaze={gaze} size={40} duration={2000} onDwellComplete={handleBackspace}>
            <button className="w-[52px] h-10 rounded-xl bg-[#ef4444] text-white text-xs font-bold">
              Del
            </button>
          </DwellPieProgress>
          <DwellPieProgress gaze={gaze} size={40} duration={2000} onDwellComplete={handleEnter}>
            <button className="w-[52px] h-10 rounded-xl bg-[#0566FF] text-white text-xs font-bold">
              Enter
            </button>
          </DwellPieProgress>
        </div>
      </div>
      <div className="bg-[#e8f0ff] rounded-2xl p-4 flex flex-col items-center gap-3 w-[340px]">
        <div className="flex justify-center">
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[0]} groupIndex={0} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
        </div>
        <div className="flex justify-center gap-16">
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[1]} groupIndex={1} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[2]} groupIndex={2} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
        </div>
        <div className="flex justify-center gap-16">
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[3]} groupIndex={3} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[4]} groupIndex={4} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
        </div>
        <div className="flex justify-center gap-8">
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[5]} groupIndex={5} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
          <LetterGroupCircle gaze={gaze} group={LETTER_GROUPS[6]} groupIndex={6} hoveredGroup={hoveredGroup} expandedGroup={expandedGroup} onHover={handleGroupHover} onLeave={() => setHoveredGroup(null)} onChar={handleChar} onClose={() => setExpandedGroup(null)} />
        </div>
      </div>
      <DwellPieProgress gaze={gaze} size={32} duration={2000} onDwellComplete={handleSpace} className="w-full">
        <button className="w-full h-9 rounded-xl bg-white text-[#9ca3af] text-sm font-medium shadow-md">
          SPACE
        </button>
      </DwellPieProgress>
      <div className="flex gap-1 flex-wrap justify-center">
        {PUNCTUATION_ROW.map((p) => (
          <DwellPieProgress gaze={gaze} key={p} size={28} duration={2000} onDwellComplete={() => handleChar(p)}>
            <button className="w-7 h-7 rounded-md bg-[#e5e7eb] text-[#333] text-xs font-medium">
              {p}
            </button>
          </DwellPieProgress>
        ))}
      </div>
    </div>
  )
}
