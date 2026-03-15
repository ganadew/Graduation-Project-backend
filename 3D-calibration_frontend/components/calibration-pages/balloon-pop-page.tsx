"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const POINTS = [
  { x: 0.5, y: 0.5 },
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.2, y: 0.8 },
  { x: 0.8, y: 0.8 },
]
const POINT_DURATION_MS = 7000
const GAZE_DWELL_MS = 2000
const GAZE_THRESHOLD = 0.08

interface BalloonPopPageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
}

export default function BalloonPopPage({ gaze, onSendSamples }: BalloonPopPageProps) {
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
        onSendSamples(toSend, "balloon_pop")
      }
      samplesRef.current = samplesRef.current.filter(
        (s) => !(s.targetX === point.x && s.targetY === point.y)
      )
      if (idx >= POINTS.length - 1) {
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
    const point = POINTS[currentIndex]
    if (!point) return

    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setProgress(Math.min(100, (elapsed / POINT_DURATION_MS) * 100))
    }, 100)

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
    const point = POINTS[currentIndex]
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
    const point = POINTS[currentIndex]
    if (!point) return
    samplesRef.current.push({
      targetX: point.x,
      targetY: point.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isRunning, currentIndex])

  const point = POINTS[currentIndex]

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <h2 className="text-xl font-semibold text-[#333] mb-2">풍선 터트리기</h2>
      <p className="text-sm text-[#666] mb-6">
        풍선을 순서대로 따라가세요. (5개, 각 7초) 2초 이상 응시하면 다음으로 넘어갑니다.
      </p>

      {point ? (
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{
            left: `${point.x * 100}%`,
            top: "45%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* 풍선 모양 UI */}
          <div className="relative flex flex-col items-center">
            <div
              className="w-16 h-20 rounded-full"
              style={{
                background: "linear-gradient(145deg, #ff7eb3 0%, #ff6b9d 30%, #c44569 100%)",
                border: "3px solid rgba(255,255,255,0.9)",
                boxShadow: "0 4px 16px rgba(196,69,105,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
              }}
            />
            <div
              className="w-3 h-4 -mt-1 rounded-b-full"
              style={{
                background: "linear-gradient(180deg, #c44569, #a63d5a)",
                border: "2px solid rgba(255,255,255,0.6)",
              }}
            />
            <div className="w-0.5 h-5 bg-[#666] -mt-0.5" style={{ background: "linear-gradient(180deg, #888, #555)" }} />
          </div>
          <span className="mt-4 text-sm font-medium text-[#333]">
            {currentIndex + 1} / {POINTS.length}
          </span>
          <div className="mt-2 w-24 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0566FF] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
