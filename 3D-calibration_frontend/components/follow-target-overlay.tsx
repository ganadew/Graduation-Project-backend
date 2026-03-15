"use client"

/**
 * 따라가기 캘리브레이션: 사용자가 따라가야 하는 투명 원형 타겟
 * 5점 시퀀스(중심, 좌상, 우상, 좌하, 우하)로 이동하며 정답값 + 시선 좌표 수집
 */
import { useState, useEffect, useCallback, useRef } from "react"

const FOLLOW_TARGET_POINTS: { x: number; y: number; label: string }[] = [
  { x: 0.5, y: 0.5, label: "중심" },
  { x: 0.1, y: 0.1, label: "좌상" },
  { x: 0.9, y: 0.1, label: "우상" },
  { x: 0.1, y: 0.9, label: "좌하" },
  { x: 0.9, y: 0.9, label: "우하" },
]

const POINT_DURATION_MS = 10000
const CIRCLE_SIZE = 56

export interface FollowTargetOverlayProps {
  /** 시선 좌표 (0~1 정규화) */
  gaze: { x: number; y: number } | null
  /** WebSocket으로 샘플 전송 */
  onSendSamples: (samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[]) => void
  /** 활성화 여부 */
  active: boolean
  /** 시작 콜백 */
  onStart?: () => void
  /** 완료 콜백 */
  onComplete?: () => void
}

export default function FollowTargetOverlay({
  gaze,
  onSendSamples,
  active,
  onStart,
  onComplete,
}: FollowTargetOverlayProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const samplesRef = useRef<{ targetX: number; targetY: number; gazeX: number; gazeY: number }[]>([])
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    if (!active || isRunning) return
    setIsRunning(true)
    setCurrentIndex(0)
    setProgress(0)
    samplesRef.current = []
    onStart?.()
  }, [active, isRunning, onStart])

  const stop = useCallback(() => {
    setIsRunning(false)
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    onComplete?.()
  }, [onComplete])

  // 포인트별 샘플 수집 + 다음 포인트로 이동
  useEffect(() => {
    if (!isRunning || !active) return

    const point = FOLLOW_TARGET_POINTS[currentIndex]
    if (!point) return

    // progress 바 애니메이션 (샘플 수집은 gaze effect에서 수행)
    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setProgress(Math.min(100, (elapsed / POINT_DURATION_MS) * 100))
    }, 50)

    const timer = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(100)

      // 현재 포인트에서 수집한 샘플 전송
      const toSend = samplesRef.current.filter(
        (s) => s.targetX === point.x && s.targetY === point.y
      )
      if (toSend.length > 0) {
        onSendSamples(toSend)
      }
      samplesRef.current = samplesRef.current.filter(
        (s) => !(s.targetX === point.x && s.targetY === point.y)
      )

      if (currentIndex >= FOLLOW_TARGET_POINTS.length - 1) {
        stop()
      } else {
        setCurrentIndex((i) => i + 1)
        setProgress(0)
      }
    }, POINT_DURATION_MS)

    return () => {
      clearTimeout(timer)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [isRunning, currentIndex, active, onSendSamples, stop])

  // gaze 의존성 - 샘플 수집은 ref로 처리하므로 여기서는 progress 등만
  useEffect(() => {
    if (!isRunning || !gaze) return
    const point = FOLLOW_TARGET_POINTS[currentIndex]
    if (!point) return
    samplesRef.current.push({
      targetX: point.x,
      targetY: point.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isRunning, currentIndex])

  if (!active) return null

  const point = isRunning ? FOLLOW_TARGET_POINTS[currentIndex] : null

  return (
    <div className="fixed inset-0 z-[8999] flex flex-col items-start justify-start pointer-events-none">
      {!isRunning ? (
        <div className="pointer-events-auto absolute top-36 left-8">
          <button
            onClick={start}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-cyan-700 transition-colors"
          >
            따라가기 캘리브레이션 시작
          </button>
        </div>
      ) : point ? (
        <div
          className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* 다이아몬드 타겟 - 흰색, 외곽 블러 */}
          <div className="relative" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
            <div
              className="absolute inset-0 flex items-center justify-center bg-white/90 shadow-[0_0_20px_6px_rgba(255,255,255,0.5)]"
              style={{
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                filter: "drop-shadow(0 0 10px rgba(255,255,255,0.7))",
              }}
            />
            <div
              className="absolute inset-[-3px] animate-pulse opacity-50"
              style={{
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                background: "rgba(255,255,255,0.4)",
                filter: "blur(6px)",
              }}
            />
          </div>
          <p className="mt-2 rounded bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
            {point.label} - 시선을 맞춰주세요 ({currentIndex + 1}/{FOLLOW_TARGET_POINTS.length})
          </p>
          {/* 진행 바 */}
          <div className="mt-2 w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
