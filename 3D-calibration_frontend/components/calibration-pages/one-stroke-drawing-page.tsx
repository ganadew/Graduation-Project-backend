"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// 병아리 점선 26점 좌표 (이미지 기준: 1=머리 꼭대기, 2-11=왼쪽, 12-15=아래, 16-24=오른쪽, 25-26=머리로 복귀)
const CHICK_POINTS: { x: number; y: number }[] = [
  { x: 0.5, y: 0.08 },   // 1 머리 꼭대기
  { x: 0.42, y: 0.12 },   // 2
  { x: 0.35, y: 0.18 },   // 3 (머리 깃털 근처)
  { x: 0.28, y: 0.28 },   // 4 왼쪽 날개
  { x: 0.24, y: 0.38 },   // 5
  { x: 0.26, y: 0.48 },   // 6
  { x: 0.32, y: 0.56 },   // 7
  { x: 0.4, y: 0.6 },     // 8
  { x: 0.5, y: 0.62 },    // 9
  { x: 0.6, y: 0.6 },     // 10
  { x: 0.66, y: 0.56 },   // 11
  { x: 0.58, y: 0.68 },   // 12 발 근처
  { x: 0.66, y: 0.66 },   // 13
  { x: 0.74, y: 0.68 },   // 14
  { x: 0.76, y: 0.58 },   // 15
  { x: 0.76, y: 0.48 },   // 16
  { x: 0.72, y: 0.38 },   // 17 꼬리
  { x: 0.66, y: 0.28 },   // 18
  { x: 0.58, y: 0.22 },   // 19 부리 근처
  { x: 0.5, y: 0.18 },    // 20
  { x: 0.44, y: 0.2 },    // 21
  { x: 0.4, y: 0.24 },    // 22
  { x: 0.44, y: 0.16 },   // 23
  { x: 0.5, y: 0.12 },    // 24
  { x: 0.48, y: 0.1 },    // 25
  { x: 0.5, y: 0.08 },    // 26 1로 복귀
]

const POINT_DURATION_MS = 7000
const GAZE_DWELL_MS = 2000
const GAZE_THRESHOLD = 0.06

interface OneStrokeDrawingPageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
}

export default function OneStrokeDrawingPage({ gaze, onSendSamples }: OneStrokeDrawingPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const samplesRef = useRef<{ targetX: number; targetY: number; gazeX: number; gazeY: number }[]>([])
  const gazeDwellStartRef = useRef<number | null>(null)
  const advancedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const advanceToNext = useCallback(
    (point: { x: number; y: number }, idx: number) => {
      if (advancedRef.current) return
      advancedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)

      const toSend = samplesRef.current.filter(
        (s) => s.targetX === point.x && s.targetY === point.y
      )
      if (toSend.length > 0) {
        onSendSamples(toSend, "one_stroke_drawing")
      }
      samplesRef.current = samplesRef.current.filter(
        (s) => !(s.targetX === point.x && s.targetY === point.y)
      )
      if (idx >= CHICK_POINTS.length - 1) {
        setIsRunning(false)
      } else {
        setCurrentIndex(idx + 1)
        setProgress(0)
      }
      gazeDwellStartRef.current = null
    },
    [onSendSamples]
  )

  const start = useCallback(() => {
    setIsRunning(true)
    setCurrentIndex(0)
    setProgress(0)
    samplesRef.current = []
    gazeDwellStartRef.current = null
  }, [])

  // 페이지 진입 시 바로 캘리브레이션이 시작되도록 자동 시작
  useEffect(() => {
    if (!isRunning) {
      start()
    }
  }, [isRunning, start])

  useEffect(() => {
    if (!isRunning) return
    advancedRef.current = false
    const point = CHICK_POINTS[currentIndex]
    if (!point) return

    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - startTime) / POINT_DURATION_MS) * 100))
    }, 50)

    timerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      advanceToNext(point, currentIndex)
    }, POINT_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [isRunning, currentIndex, advanceToNext])

  useEffect(() => {
    if (!isRunning || !gaze) return
    const point = CHICK_POINTS[currentIndex]
    if (!point) return

    const dist = Math.sqrt((gaze.x - point.x) ** 2 + (gaze.y - point.y) ** 2)
    if (dist <= GAZE_THRESHOLD) {
      const now = Date.now()
      if (gazeDwellStartRef.current === null) {
        gazeDwellStartRef.current = now
      }
      if (now - gazeDwellStartRef.current >= GAZE_DWELL_MS) {
        advanceToNext(point, currentIndex)
        return
      }
    } else {
      gazeDwellStartRef.current = null
    }
  }, [gaze?.x, gaze?.y, isRunning, currentIndex, advanceToNext])

  useEffect(() => {
    if (!isRunning || !gaze) return
    const point = CHICK_POINTS[currentIndex]
    if (!point) return
    samplesRef.current.push({
      targetX: point.x,
      targetY: point.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isRunning, currentIndex])

  const point = CHICK_POINTS[currentIndex]

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <h2 className="text-xl font-semibold text-[#333] mb-2">한붓 그리기</h2>
      <p className="text-sm text-[#666] mb-4">
        순서대로 점을 이어서 병아리 그림을 완성해보세요. (26점, 각 7초) 2초 이상 응시하면 다음으로 넘어갑니다.
      </p>

      {isRunning ? (
        <div className="relative w-full max-w-4xl aspect-[4/3] bg-[#fafafa] rounded-2xl border-2 border-[#e5e7eb] p-6 overflow-hidden">
          {/* 병아리 점선 이미지 배경 */}
          <div
            className="absolute inset-6 bg-contain bg-center bg-no-repeat opacity-60"
            style={{ backgroundImage: "url('/chick-connect-dots.png')" }}
          />
          {/* 점선 SVG 경로 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {CHICK_POINTS.slice(0, -1).map((p, i) => (
              <line
                key={i}
                x1={p.x * 100}
                y1={p.y * 100}
                x2={CHICK_POINTS[i + 1].x * 100}
                y2={CHICK_POINTS[i + 1].y * 100}
                stroke="#0566FF"
                strokeWidth="0.8"
                strokeDasharray="3 2"
                opacity={i < currentIndex ? 0.9 : 0.35}
              />
            ))}
          </svg>
          {/* 현재 점 하이라이트 */}
          {point && (
            <div
              className="absolute w-8 h-8 rounded-full bg-[#0566FF] border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold animate-pulse"
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {currentIndex + 1}
            </div>
          )}
        </div>
      ) : null}
      {isRunning && (
        <div className="mt-4 w-56">
          <div className="flex justify-between text-xs text-[#666] mb-1">
            <span>{currentIndex + 1} / {CHICK_POINTS.length}</span>
          </div>
          <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0566FF] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
