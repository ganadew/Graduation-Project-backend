"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Scissors } from "lucide-react"
import NavigationButtons from "@/components/calibration/navigation-buttons"

interface SnackPageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
  onNext: () => void
  onPrevious: () => void
  progress: number
}

const SNACK_PATTERNS = [
  { id: 1, name: "가로", startX: 5, startY: 25, endX: 95, endY: 25, snackRotation: 0 },
  { id: 2, name: "대각선 (좌하 -> 우상)", startX: 5, startY: 85, endX: 75, endY: 15, snackRotation: 45 },
  { id: 3, name: "대각선 (우상 -> 좌하)", startX: 75, startY: 15, endX: 5, endY: 85, snackRotation: -45 },
]

const DURATION_MS = 7000
// 파란 타겟 반지름(px) 기반 판정 (시선점-원중심 거리)
// 파란 원(w-16=64px)의 반지름 32px + 여유
const BLUE_TARGET_RADIUS_PX = 40

export default function SnackPage({ gaze, onSendSamples, onNext, onPrevious, progress }: SnackPageProps) {
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [circlePosition, setCirclePosition] = useState({ x: 0, y: 0 })
  const [animationProgress, setAnimationProgress] = useState(0)
  const [completedPatterns, setCompletedPatterns] = useState<Set<number>>(new Set())
  const [allCompleted, setAllCompleted] = useState(false)

  const animationRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isGazeInsideCircle, setIsGazeInsideCircle] = useState(false)
  const isGazeInsideCircleRef = useRef(false)
  const [isHoveringCircle, setIsHoveringCircle] = useState(false)
  const isHoveringCircleRef = useRef(false)

  const samplesRef = useRef<{ targetX: number; targetY: number; gazeX: number; gazeY: number }[]>([])

  const playTearSound = useCallback(() => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      const ctx = audioContextRef.current
      const bufferSize = ctx.sampleRate * 0.3
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1))
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = "highpass"
      filter.frequency.value = 1000
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      source.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(ctx.destination)
      source.start(ctx.currentTime)
    } catch {
      // ignore
    }
  }, [])

  const flushSamples = useCallback(
    (patternId: number) => {
      if (samplesRef.current.length === 0) return
      onSendSamples(samplesRef.current, `snack_${patternId}`)
      samplesRef.current = []
    },
    [onSendSamples]
  )

  useEffect(() => {
    if (!isPlaying || currentPatternIndex < 0 || currentPatternIndex >= SNACK_PATTERNS.length) return
    const pattern = SNACK_PATTERNS[currentPatternIndex]
    setCirclePosition({ x: pattern.startX, y: pattern.startY })
    setAnimationProgress(0)
    lastFrameRef.current = null

    const animate = () => {
      const now = performance.now()
      const dt = lastFrameRef.current === null ? 0 : now - lastFrameRef.current
      lastFrameRef.current = now

      const canAdvance = isHoveringCircleRef.current || isGazeInsideCircleRef.current
      setAnimationProgress((prev) => {
        const nextP = canAdvance ? Math.min(prev + dt / DURATION_MS, 1) : prev
        const x = pattern.startX + (pattern.endX - pattern.startX) * nextP
        const y = pattern.startY + (pattern.endY - pattern.startY) * nextP
        setCirclePosition({ x, y })

        if (nextP >= 1 && prev < 1) {
          playTearSound()
          flushSamples(pattern.id)
          setCompletedPatterns((p0) => new Set([...p0, pattern.id]))
          setTimeout(() => {
            if (currentPatternIndex < SNACK_PATTERNS.length - 1) {
              setCurrentPatternIndex((p1) => p1 + 1)
            } else {
              setIsPlaying(false)
              setAllCompleted(true)
              setTimeout(() => onNext(), 1000)
            }
          }, 1000)
        }

        return nextP
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [currentPatternIndex, isPlaying, playTearSound, flushSamples, onNext])

  useEffect(() => {
    if (!isPlaying || !gaze) return
    samplesRef.current.push({
      targetX: circlePosition.x / 100,
      targetY: circlePosition.y / 100,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isPlaying, circlePosition.x, circlePosition.y])

  useEffect(() => {
    if (!isPlaying || !gaze || !containerRef.current) {
      setIsGazeInsideCircle(false)
      isGazeInsideCircleRef.current = false
      return
    }

    // 원의 중심을 "뷰포트 기준 정규화" 좌표로 변환해서 시선 좌표와 비교
    const rect = containerRef.current.getBoundingClientRect()
    const cxPx = rect.left + (circlePosition.x / 100) * rect.width
    const cyPx = rect.top + (circlePosition.y / 100) * rect.height
    const gazePxX = gaze.x * window.innerWidth
    const gazePxY = gaze.y * window.innerHeight
    const distPx = Math.sqrt((gazePxX - cxPx) ** 2 + (gazePxY - cyPx) ** 2)

    const inside = distPx <= BLUE_TARGET_RADIUS_PX
    setIsGazeInsideCircle(inside)
    isGazeInsideCircleRef.current = inside
  }, [gaze?.x, gaze?.y, isPlaying, circlePosition.x, circlePosition.y])

  useEffect(() => {
    isHoveringCircleRef.current = isHoveringCircle
  }, [isHoveringCircle])

  useEffect(() => {
    isGazeInsideCircleRef.current = isGazeInsideCircle
  }, [isGazeInsideCircle])

  const currentPattern =
    currentPatternIndex >= 0 && currentPatternIndex < SNACK_PATTERNS.length ? SNACK_PATTERNS[currentPatternIndex] : null

  const getLineAngle = (pattern: (typeof SNACK_PATTERNS)[number]) => {
    const dx = pattern.endX - pattern.startX
    const dy = pattern.endY - pattern.startY
    return Math.atan2(dy, dx) * (180 / Math.PI)
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute top-6 left-8 z-10">
        <h1 className="text-4xl font-bold text-black">과자봉지 뜯기</h1>
        <p className="text-xl text-gray-600 mt-2">파란원을 따라 절취선을 따라가세요!</p>
      </div>

      {isPlaying && currentPattern && (
        <div className="absolute top-28 left-8 bg-white/90 px-6 py-3 rounded-xl shadow-lg z-10">
          <span className="text-xl font-bold text-black">
            패턴 {currentPatternIndex + 1} / {SNACK_PATTERNS.length}: {currentPattern.name}
          </span>
        </div>
      )}

      {allCompleted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-40">
          <div className="bg-white rounded-3xl p-10 shadow-2xl text-center">
            <h2 className="text-3xl font-bold text-black mb-4">모든 패턴 완료!</h2>
            <p className="text-xl text-gray-600">다음 단계로 이동합니다.</p>
            <div className="mt-6 text-sm text-gray-500">완료: {Array.from(completedPatterns).length} / 3</div>
          </div>
        </div>
      )}

      <div className="relative w-full h-screen flex items-center justify-center">
        {isPlaying && currentPattern && (
          <div
            className="relative"
            ref={containerRef}
            style={{
              width: 500,
              height: 600,
              transform: `rotate(${currentPattern.snackRotation}deg)`,
              transition: "transform 0.5s ease-in-out",
            }}
          >
            <div
              className="absolute z-30"
              style={{
                left: `${currentPattern.startX}%`,
                top: `${currentPattern.startY}%`,
                transform: `translate(-100%, -50%) rotate(${getLineAngle(currentPattern) - currentPattern.snackRotation}deg)`,
              }}
            >
              <Scissors className="w-10 h-10 text-black" />
            </div>

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              <line
                x1={`${currentPattern.startX}%`}
                y1={`${currentPattern.startY}%`}
                x2={`${currentPattern.endX}%`}
                y2={`${currentPattern.endY}%`}
                stroke="black"
                strokeWidth="3"
                strokeDasharray="12,8"
                opacity={0.7}
              />
              <line
                x1={`${currentPattern.startX}%`}
                y1={`${currentPattern.startY}%`}
                x2={`${circlePosition.x}%`}
                y2={`${circlePosition.y}%`}
                stroke="#0566FF"
                strokeWidth="4"
              />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative" style={{ width: 280, height: 380 }}>
                <div
                  className="absolute top-0 left-0 right-0 h-16 rounded-t-lg"
                  style={{ background: "linear-gradient(180deg, #8BC34A 0%, #689F38 100%)" }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <span className="text-xs text-white font-bold">농심</span>
                  </div>
                  <div className="absolute top-1 right-4 w-10 h-10 rounded-full bg-amber-600 border-2 border-amber-700">
                    <div className="absolute top-2 left-1 w-2 h-2 bg-black rounded-full" />
                    <div className="absolute top-2 right-1 w-2 h-2 bg-black rounded-full" />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-amber-400 rounded-full" />
                  </div>
                </div>

                <div
                  className="absolute top-16 left-0 right-0 bottom-0 rounded-b-lg overflow-hidden"
                  style={{ background: "linear-gradient(180deg, #FFD54F 0%, #FFCA28 50%, #FFB300 100%)" }}
                >
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
                    <div
                      className="text-3xl font-bold text-white"
                      style={{
                        textShadow:
                          "3px 3px 0 #7B1FA2, -1px -1px 0 #7B1FA2, 1px -1px 0 #7B1FA2, -1px 1px 0 #7B1FA2",
                        fontFamily: "Arial Black, sans-serif",
                      }}
                    >
                      바나나킥
                    </div>
                    <div className="text-sm text-amber-800 mt-1">바나나 맛 그대로!</div>
                  </div>

                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                    <div className="relative">
                      <div
                        className="w-14 h-20 rounded-full bg-yellow-200 border-2 border-yellow-400"
                        style={{ transform: "rotate(-10deg)" }}
                      >
                        <div className="absolute top-4 left-2 w-2 h-2 bg-black rounded-full" />
                        <div className="absolute top-4 right-2 w-2 h-2 bg-black rounded-full" />
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-3 h-2 bg-red-400 rounded-full" />
                      </div>
                      <div className="absolute -top-4 -left-6 w-7 h-7 bg-white rounded-full border-2 border-black" />
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-6 h-10 rounded-full border border-yellow-300"
                        style={{
                          transform: `rotate(${(i - 2) * 15}deg)`,
                          background: "linear-gradient(180deg, #FFF9C4 0%, #FFEB3B 100%)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {animationProgress < 1 && (
              <div
                className="absolute w-16 h-16 rounded-full border-4 border-[#0566FF] bg-[#0566FF]/20 z-30"
                style={{
                  left: `${circlePosition.x}%`,
                  top: `${circlePosition.y}%`,
                  transform: `translate(-50%, -50%) rotate(${-currentPattern.snackRotation}deg)`,
                  boxShadow: "0 0 25px rgba(5, 102, 255, 0.5)",
                }}
                onMouseEnter={() => setIsHoveringCircle(true)}
                onMouseLeave={() => setIsHoveringCircle(false)}
              >
                <div className="absolute inset-2 rounded-full bg-[#0566FF]/30" />
                <div className="absolute inset-0 rounded-full border-2 border-[#0566FF] animate-ping" />
                {(isHoveringCircle || isGazeInsideCircle) && (
                  <div className="absolute inset-0 rounded-full border-2 border-green-500 bg-green-500/20" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <NavigationButtons gaze={gaze} onNext={onNext} onPrevious={onPrevious} progress={progress} />
    </div>
  )
}

