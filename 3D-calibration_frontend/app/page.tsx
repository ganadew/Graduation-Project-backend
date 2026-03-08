"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DwellPieProgress from "@/components/dwell-pie-progress"
import KoreanKeyboard from "@/components/korean-keyboard"
import GazePointerDispatcher from "@/components/gaze-pointer-dispatcher"
import GazeCursor from "@/components/gaze-cursor"
import WebcamPreview from "@/components/webcam-preview"
import CalibrationOverlay from "@/components/calibration-overlay"
import GazeDebugPanel from "@/components/gaze-debug-panel"
import { useGazeTracking } from "@/hooks/use-gaze-tracking"

const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false })

const calibrationSteps = [
  {
    id: 1,
    title: "시선 캘리브레이션",
    description: "화면의 캐릭터가 커서를 따라다닙니다. 시선을 맞춰보세요.",
    splineUrl: "https://my.spline.design/cutecomputerfollowcursor-EAFrQ5nqOIutDFlrc9fr4IWZ/",
    splineCodeUrl: "https://prod.spline.design/0U6HkU94xGHhzsx1/scene.splinecode",
  },
  {
    id: 2,
    title: "두더지 게임",
    description: "도둑을 잡으세요! 경찰은 피하세요!",
    splineUrl: "https://my.spline.design/gamewhacathief-UQ5bXD9F9PNs6wVfwPoLxvgR/",
    splineCodeUrl: "https://prod.spline.design/v9Iojidz10BM0EUa/scene.splinecode",
  },
  {
    id: 3,
    title: "볼링 게임",
    description: "볼링공을 굴려 핀을 쓰러뜨려보세요.",
    splineUrl: "https://my.spline.design/splinebowling-6mN3TcPhiMmufr2OiBlkTWgK/",
    splineCodeUrl: "https://prod.spline.design/IIb3-I0-o5yeE5bf/scene.splinecode",
  },
  {
    id: 4,
    title: "가상 키보드 연습",
    description: "가상 키보드를 연습하세요.",
    splineUrl: "",
  },
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
    calibrationPoint,
    calibrationComplete,
    startCalibration,
  } = useGazeTracking()

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setTypedText("")
    }
  }

  const goToNext = () => {
    if (currentStep < calibrationSteps.length - 1) {
      setCurrentStep(currentStep + 1)
      setTypedText("")
    }
  }

  const handleSwitchLanguage = () => {
    setIsKorean(!isKorean)
    setTypedText("")
  }

  const currentCalibration = calibrationSteps[currentStep]
  const isKeyboardPage = currentStep === 3

  const splineCodeUrl = "splineCodeUrl" in currentCalibration ? (currentCalibration as { splineCodeUrl?: string }).splineCodeUrl : undefined

  const useGazeAsCursor = isConnected && !!gaze
  const splineRef = useRef<{ setVariable?: (name: string, value: number | boolean | string) => void } | null>(null)

  // Spline 씬에 시선 좌표를 변수로 전달 (씬이 mouseX/mouseY 변수를 쓰는 경우)
  useEffect(() => {
    if (!gaze || !splineRef.current?.setVariable) return
    try {
      splineRef.current.setVariable("mouseX", gaze.x)
      splineRef.current.setVariable("mouseY", gaze.y)
    } catch {
      // 씬에 해당 변수가 없을 수 있음
    }
  }, [gaze?.x, gaze?.y])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.cursor = useGazeAsCursor ? "none" : ""
    return () => {
      document.body.style.cursor = ""
    }
  }, [useGazeAsCursor])

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#1a1a2e]"
      style={{ cursor: useGazeAsCursor ? "none" : undefined }}
    >
      <GazePointerDispatcher gaze={gaze} />
      <GazeCursor gaze={gaze} visible={useGazeAsCursor} />
      <WebcamPreview frameData={webcamFrame} isConnected={isConnected} connectionError={connectionError} />
      <CalibrationOverlay point={calibrationPoint} />
      <GazeDebugPanel gaze={gaze} isConnected={isConnected} />
      {/* Spline Embed - Only show on non-keyboard pages */}
      {!isKeyboardPage && (
        <div className="absolute inset-0">
          {splineCodeUrl ? (
            <Spline
              scene={splineCodeUrl}
              className="w-full h-full"
              onLoad={(app) => {
                splineRef.current = app
              }}
            />
          ) : (
            <iframe
              src={currentCalibration.splineUrl}
              frameBorder="0"
              width="100%"
              height="100%"
              title={currentCalibration.title}
              className="w-full h-full"
              allow="autoplay; fullscreen"
            />
          )}
        </div>
      )}

      {/* Header - Top Left */}
      <header className="absolute top-8 left-8 z-20">
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">
          {currentCalibration.title}
        </h1>
        <p className="text-white/80 mt-2 text-lg drop-shadow-md">
          {currentCalibration.description}
        </p>
        {/* 캘리브레이션 버튼 - 3D 모듈 기반 시선 보정 */}
        {isConnected && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={startCalibration}
              disabled={!!calibrationPoint}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                calibrationPoint
                  ? "bg-cyan-500/50 text-white cursor-wait"
                  : calibrationComplete
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-cyan-600 text-white hover:bg-cyan-700"
              }`}
            >
              {calibrationPoint
                ? "캘리브레이션 진행 중..."
                : calibrationComplete
                  ? "캘리브레이션 완료 (다시 하기)"
                  : "시선 캘리브레이션 시작"}
            </button>
          </div>
        )}
      </header>

      {/* Virtual Keyboard Page - Crystal Computer + Keyboard */}
      {isKeyboardPage && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pt-20 pb-24 px-8">
          <div className="flex items-center gap-12">
            {/* Left: Crystal Computer Component */}
            <div className="flex flex-col items-center">
              <CrystalComputer typedText={typedText} />
            </div>
            
            {/* Right: Virtual Keyboard */}
            <div className="flex flex-col items-center">
              <span className="text-white text-sm font-medium mb-2">
                {isKorean ? "한글 키보드" : "영어 키보드"}
              </span>
              {isKorean ? (
                <KoreanKeyboard 
                  typedText={typedText}
                  setTypedText={setTypedText}
                  onSwitchLanguage={handleSwitchLanguage}
                />
              ) : (
                <EnglishKeyboard 
                  typedText={typedText}
                  setTypedText={setTypedText}
                  onSwitchLanguage={handleSwitchLanguage}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Area */}
      <div className="absolute bottom-8 left-0 right-0 z-20 px-8">
        <div className="flex items-center justify-between">
          {/* Empty space for balance */}
          <div className="w-[200px]" />
          
          {/* Step Indicator - Center */}
          <div className="flex items-center gap-1">
            {calibrationSteps.map((_, index) => (
              <div key={index} className="flex items-center">
                {/* Dot */}
                <button
                  onClick={() => {
                    setCurrentStep(index)
                    setTypedText("")
                  }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index <= currentStep
                      ? "bg-[#0565FF]"
                      : "bg-white/40"
                  }`}
                  aria-label={`단계 ${index + 1}로 이동`}
                />
                {/* Connecting Line */}
                {index < calibrationSteps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 transition-all duration-300 ${
                      index < currentStep
                        ? "bg-[#0565FF]"
                        : "bg-white/40"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Navigation Buttons - Right */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentStep === 0}
              className={`flex items-center gap-1 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                currentStep === 0
                  ? "text-white/30 cursor-not-allowed"
                  : "text-white hover:bg-white/10"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </button>
            <button
              onClick={goToNext}
              disabled={currentStep === calibrationSteps.length - 1}
              className={`flex items-center gap-1 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                currentStep === calibrationSteps.length - 1
                  ? "bg-[#0565FF]/50 text-white/50 cursor-not-allowed"
                  : "bg-[#0565FF] text-white hover:bg-[#0565FF]/90 shadow-lg"
              }`}
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Crystal Computer Component
function CrystalComputer({ typedText }: { typedText: string }) {
  return (
    <div className="relative" style={{ width: 400, height: 350 }}>
      {/* Monitor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        {/* Monitor Frame */}
        <div 
          className="relative rounded-[24px] p-3"
          style={{
            width: 280,
            height: 200,
            background: "linear-gradient(145deg, rgba(200, 230, 240, 0.9), rgba(180, 220, 235, 0.7))",
            boxShadow: "0 8px 32px rgba(100, 200, 220, 0.3), inset 0 2px 8px rgba(255, 255, 255, 0.5)",
            border: "2px solid rgba(255, 255, 255, 0.4)",
          }}
        >
          {/* Screen */}
          <div 
            className="w-full h-full rounded-[16px] p-4 overflow-auto"
            style={{
              background: "linear-gradient(135deg, #5a6a8a 0%, #4a5a7a 100%)",
              boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
          >
            {/* Sticky Note */}
            <div 
              className="absolute top-5 right-6 w-10 h-10 rounded-sm"
              style={{
                background: "linear-gradient(135deg, #f5e6a3 0%, #e8d88c 100%)",
                transform: "rotate(5deg)",
                boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.1)",
              }}
            />
            {/* Text Display */}
            <p className="text-white/90 text-sm font-medium whitespace-pre-wrap break-all leading-relaxed">
              {typedText}
              <span className="inline-block w-[2px] h-[16px] bg-white animate-pulse ml-[1px] align-text-bottom" />
            </p>
          </div>
        </div>
        
        {/* Monitor Stand */}
        <div 
          className="mx-auto mt-1"
          style={{
            width: 60,
            height: 20,
            background: "linear-gradient(180deg, rgba(180, 230, 240, 0.8), rgba(160, 220, 235, 0.6))",
            borderRadius: "4px 4px 8px 8px",
            boxShadow: "0 4px 8px rgba(100, 200, 220, 0.2)",
          }}
        />
        <div 
          className="mx-auto"
          style={{
            width: 80,
            height: 12,
            background: "linear-gradient(180deg, rgba(170, 225, 235, 0.7), rgba(150, 215, 230, 0.5))",
            borderRadius: "0 0 8px 8px",
            boxShadow: "0 4px 8px rgba(100, 200, 220, 0.15)",
          }}
        />
      </div>

      {/* Keyboard */}
      <div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        style={{
          width: 180,
          height: 60,
          background: "linear-gradient(145deg, rgba(180, 235, 245, 0.8), rgba(160, 225, 240, 0.6))",
          borderRadius: "12px",
          boxShadow: "0 6px 20px rgba(100, 200, 220, 0.25), inset 0 2px 6px rgba(255, 255, 255, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
        }}
      >
        {/* Keyboard Keys Grid */}
        <div className="p-2 grid grid-cols-8 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                width: 16,
                height: 14,
                background: "linear-gradient(145deg, rgba(200, 245, 255, 0.9), rgba(180, 235, 250, 0.7))",
                boxShadow: "0 1px 2px rgba(100, 200, 220, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.5)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Mouse */}
      <div 
        className="absolute bottom-10 right-8"
        style={{
          width: 40,
          height: 55,
          background: "linear-gradient(145deg, rgba(190, 240, 250, 0.85), rgba(170, 230, 245, 0.65))",
          borderRadius: "20px 20px 25px 25px",
          boxShadow: "0 4px 12px rgba(100, 200, 220, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
        }}
      >
        {/* Mouse Button Line */}
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 w-[1px] h-4"
          style={{ background: "rgba(255, 255, 255, 0.5)" }}
        />
        {/* Mouse Wheel */}
        <div 
          className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: 8,
            height: 12,
            background: "linear-gradient(145deg, rgba(210, 250, 255, 0.9), rgba(190, 240, 250, 0.7))",
            boxShadow: "inset 0 1px 2px rgba(100, 200, 220, 0.3)",
          }}
        />
      </div>

      {/* Coffee Mug */}
      <div 
        className="absolute bottom-6 left-6"
        style={{
          width: 45,
          height: 50,
          background: "linear-gradient(145deg, rgba(200, 245, 255, 0.75), rgba(180, 235, 250, 0.55))",
          borderRadius: "0 0 8px 8px",
          boxShadow: "0 4px 12px rgba(100, 200, 220, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.25)",
        }}
      >
        {/* Mug Handle */}
        <div 
          className="absolute top-2 -right-3"
          style={{
            width: 15,
            height: 25,
            background: "transparent",
            border: "3px solid rgba(190, 240, 250, 0.7)",
            borderRadius: "0 12px 12px 0",
            borderLeft: "none",
          }}
        />
        {/* Coffee */}
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: 30,
            height: 10,
            background: "linear-gradient(180deg, #6b5344 0%, #5a4538 100%)",
          }}
        />
      </div>
    </div>
  )
}

// Letter Group Circle Component for English Keyboard
function LetterGroupCircle({
  group,
  groupIndex,
  hoveredGroup,
  expandedGroup,
  onHover,
  onLeave,
  onChar,
  onClose,
}: {
  group: string[]
  groupIndex: number
  hoveredGroup: number | null
  expandedGroup: number | null
  onHover: (index: number) => void
  onLeave: () => void
  onChar: (char: string) => void
  onClose: () => void
}) {
  const isHovered = hoveredGroup === groupIndex
  const isExpanded = expandedGroup === groupIndex
  const letterColors = ["#3b82f6", "#ef4444", "#eab308", "#22c55e"]

  if (isExpanded) {
    return (
      <div className="relative w-[90px] h-[90px]">
        {group.map((letter, li) => {
          const letterPositions = [
            { x: 0, y: -26 },
            { x: -26, y: 0 },
            { x: 26, y: 0 },
            { x: 0, y: 26 },
          ]
          const lpos = letterPositions[li] || { x: 0, y: 0 }
          const color = letterColors[li % letterColors.length]

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
                size={32}
                duration={1000}
                onDwellComplete={() => onChar(letter)}
              >
                <button
                  className="w-[30px] h-[30px] rounded-full text-sm font-bold text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                >
                  {letter}
                </button>
              </DwellPieProgress>
            </div>
          )
        })}
        <button
          onClick={onClose}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded-full bg-[#9ca3af] text-white text-[10px] flex items-center justify-center hover:bg-[#6b7280] cursor-pointer"
        >
          X
        </button>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => onHover(groupIndex)}
      onMouseLeave={onLeave}
      className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer
        ${isHovered 
          ? "bg-[#0565FF] shadow-lg shadow-[#0565FF]/40 scale-110 ring-2 ring-[#0565FF]" 
          : "bg-white shadow-md hover:bg-[#f0f4ff]"
        }`}
    >
      <div className="grid grid-cols-2 gap-0.5">
        {group.map((letter, li) => (
          <span
            key={li}
            className={`text-xs font-semibold w-[18px] h-[18px] flex items-center justify-center rounded transition-colors
              ${isHovered ? "text-white" : "text-[#1a1a1a]"}`}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  )
}

// English Keyboard Component - Grid-based layout
const LETTER_GROUPS = [
  ["q", "r", "s", "t"],
  ["a", "b", "c", "d"],
  ["e", "f", "g", "h"],
  ["i", "j", "k", "l"],
  ["m", "n", "o", "p"],
  ["u", "v", "w", "x"],
  ["y", "z"],
]

const LETTER_COLORS = ["#3b82f6", "#ef4444", "#eab308", "#22c55e"]
const PUNCTUATION_ROW = [":", "@", "#", "*", "&", "~", "%", "-", "+", "=", "\\", "/", ".", ",", "?", "!"]

function EnglishKeyboard({ 
  typedText,
  setTypedText,
  onSwitchLanguage
}: { 
  typedText: string
  setTypedText: (text: string) => void
  onSwitchLanguage?: () => void
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
    setTimeout(() => {
      setExpandedGroup(groupIndex)
    }, 300)
  }, [])

  const handleGroupLeave = useCallback(() => {
    setHoveredGroup(null)
  }, [])

  return (
    <div className="relative bg-[#f0f2f5] rounded-2xl shadow-2xl p-4 flex flex-col items-center gap-3" style={{ width: 420 }}>
      {/* Top: Language toggle button */}
      <DwellPieProgress size={40} duration={1000} onDwellComplete={() => onSwitchLanguage?.()}>
        <button className="px-5 py-1.5 rounded-lg bg-[#0565FF] text-white text-sm font-bold flex items-center justify-center shadow-md hover:bg-[#0450cc]">
          한글
        </button>
      </DwellPieProgress>

      {/* Text display area with Del/Enter buttons */}
      <div className="flex gap-2 w-full">
        <div className="flex-1 bg-white rounded-xl border-2 border-[#e5e7eb] p-3 min-h-[80px] max-h-[100px] overflow-auto shadow-inner">
          <p className="text-sm text-[#1a1a1a] font-medium whitespace-pre-wrap break-all leading-relaxed">
            {typedText || <span className="text-[#9ca3af]">Type here...</span>}
            <span className="inline-block w-[2px] h-[16px] bg-[#0565FF] animate-pulse ml-[1px] align-text-bottom" />
          </p>
        </div>
        {/* Del + Enter buttons */}
        <div className="flex flex-col gap-1.5">
          <DwellPieProgress size={40} duration={1000} onDwellComplete={handleBackspace}>
            <button className="w-[52px] h-[40px] rounded-xl bg-[#ef4444] text-white text-xs font-bold flex items-center justify-center shadow-md hover:bg-[#dc2626]">
              Del
            </button>
          </DwellPieProgress>
          <DwellPieProgress size={40} duration={1000} onDwellComplete={handleEnter}>
            <button className="w-[52px] h-[40px] rounded-xl bg-[#0565FF] text-white text-xs font-bold flex items-center justify-center shadow-md hover:bg-[#0450cc]">
              Enter
            </button>
          </DwellPieProgress>
        </div>
      </div>

      {/* Letter groups in grid layout */}
      <div className="bg-[#e8f0ff] rounded-2xl p-4 flex flex-col items-center gap-3" style={{ width: 340 }}>
        {/* Row 1: q r s t (center) */}
        <div className="flex justify-center">
          <LetterGroupCircle
            group={LETTER_GROUPS[0]}
            groupIndex={0}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
        </div>
        
        {/* Row 2: a b c d | e f g h */}
        <div className="flex justify-center gap-16">
          <LetterGroupCircle
            group={LETTER_GROUPS[1]}
            groupIndex={1}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
          <LetterGroupCircle
            group={LETTER_GROUPS[2]}
            groupIndex={2}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
        </div>
        
        {/* Row 3: i j k l | m n o p */}
        <div className="flex justify-center gap-16">
          <LetterGroupCircle
            group={LETTER_GROUPS[3]}
            groupIndex={3}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
          <LetterGroupCircle
            group={LETTER_GROUPS[4]}
            groupIndex={4}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
        </div>
        
        {/* Row 4: u v w x | y z */}
        <div className="flex justify-center gap-8">
          <LetterGroupCircle
            group={LETTER_GROUPS[5]}
            groupIndex={5}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
          <LetterGroupCircle
            group={LETTER_GROUPS[6]}
            groupIndex={6}
            hoveredGroup={hoveredGroup}
            expandedGroup={expandedGroup}
            onHover={handleGroupHover}
            onLeave={handleGroupLeave}
            onChar={handleChar}
            onClose={() => setExpandedGroup(null)}
          />
        </div>
      </div>

      {/* Space bar */}
      <DwellPieProgress size={32} duration={1000} onDwellComplete={handleSpace} className="w-full">
        <button className="w-full h-[36px] rounded-xl bg-white text-[#9ca3af] text-sm font-medium flex items-center justify-center shadow-md hover:bg-[#f0f4ff]">
          SPACE
        </button>
      </DwellPieProgress>

      {/* Punctuation row */}
      <div className="flex gap-1 flex-wrap justify-center">
        {PUNCTUATION_ROW.map((p) => (
          <DwellPieProgress key={p} size={28} duration={1000} onDwellComplete={() => handleChar(p)}>
            <button className="w-[28px] h-[28px] rounded-md bg-[#e5e7eb] text-[#1a1a1a] text-xs font-medium flex items-center justify-center shadow-sm hover:bg-[#d1d5db]">
              {p}
            </button>
          </DwellPieProgress>
        ))}
      </div>
    </div>
  )
}
