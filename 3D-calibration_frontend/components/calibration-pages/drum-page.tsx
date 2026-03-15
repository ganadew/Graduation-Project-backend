"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import NavigationButtons from "@/components/calibration/navigation-buttons"

interface DrumPageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
  onNext: () => void
  onPrevious: () => void
  progress: number
}

type DrumTarget = {
  id: number
  label: string
  sound: string
  style: { top: number; left?: number; right?: number }
}

const DRUM_CONTAINER = { width: 600, height: 520 }

const DRUM_TARGETS: DrumTarget[] = [
  { id: 1, label: "1", sound: "crash", style: { top: 80, left: 75 } },
  { id: 2, label: "2", sound: "ride", style: { top: 87, left: 165 } },
  { id: 3, label: "3", sound: "tom-low", style: { top: 320, left: 133 } },
  { id: 4, label: "4", sound: "tom-mid", style: { top: 220, left: 222 } },
  { id: 5, label: "5", sound: "tom-high", style: { top: 240, right: 227 } },
  { id: 6, label: "6", sound: "kick", style: { top: 355, right: 308 } },
  { id: 7, label: "7", sound: "kick", style: { top: 355, right: 250 } },
  { id: 8, label: "8", sound: "hihat-open", style: { top: 144, right: 165 } },
  { id: 9, label: "9", sound: "hihat-close", style: { top: 150, right: 60 } },
  { id: 10, label: "10", sound: "snare", style: { top: 280, right: 145 } },
]

const SOUND_URLS: Record<string, string> = {
  crash:
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/crash.wav",
  ride:
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/ride.wav",
  "tom-low":
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/tom-low.wav",
  "tom-mid":
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/tom-mid.wav",
  "tom-high":
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/tom-high.wav",
  kick:
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/kick.wav",
  snare:
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/snare.wav",
  "hihat-open":
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/hihat-open.wav",
  "hihat-close":
    "https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/sounds/hihat-close.wav",
}

const POINT_DURATION_MS = 7000
const GAZE_DWELL_MS = 2000
// 파란 타겟 반지름(px) 기반 판정 (시선점-원중심 거리)
// 파란 원(70px)의 반지름은 35px이지만, 조금 더 관대하게 인식되도록 여유를 둠
const BLUE_TARGET_RADIUS_PX = 44

function getTargetCenterPx(target: DrumTarget) {
  const x =
    target.style.left !== undefined
      ? target.style.left + 21
      : target.style.right !== undefined
        ? DRUM_CONTAINER.width - target.style.right + 21
        : DRUM_CONTAINER.width / 2
  const y = target.style.top + 21
  return { x, y }
}

export default function DrumPage({
  gaze,
  onSendSamples,
  onNext,
  onPrevious,
  progress,
}: DrumPageProps) {
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [hitTargets, setHitTargets] = useState<Set<number>>(new Set())
  const [playingKeys, setPlayingKeys] = useState<Set<string>>(new Set())
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  const samplesRef = useRef<
    { targetX: number; targetY: number; gazeX: number; gazeY: number; targetId: number }[]
  >([])
  const dwellStartRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isGazeInsideBlue, setIsGazeInsideBlue] = useState(false)
  const drumContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      const audio = new Audio(url)
      audio.preload = "auto"
      audioRefs.current[key] = audio
    })
  }, [])

  const playSound = useCallback((soundType: string, keyLabel: string) => {
    const audio = audioRefs.current[soundType]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }

    setPlayingKeys((prev) => new Set([...prev, keyLabel]))
    setTimeout(() => {
      setPlayingKeys((prev) => {
        const next = new Set(prev)
        next.delete(keyLabel)
        return next
      })
    }, 100)
  }, [])

  const sendAndClearSamplesForTarget = useCallback(
    (targetId: number) => {
      const toSend = samplesRef.current
        .filter((s) => s.targetId === targetId)
        .map(({ targetX, targetY, gazeX, gazeY }) => ({ targetX, targetY, gazeX, gazeY }))
      if (toSend.length > 0) onSendSamples(toSend, "drum")
      samplesRef.current = samplesRef.current.filter((s) => s.targetId !== targetId)
    },
    [onSendSamples]
  )

  useEffect(() => {
    if (!isPlaying) return

    if (currentTargetIndex >= DRUM_TARGETS.length) {
      setIsPlaying(false)
      setTimeout(() => onNext(), 1000)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentTargetIndex((prev) => prev + 1)
    }, POINT_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [currentTargetIndex, isPlaying, onNext])

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleTargetHit = useCallback(
    (target: DrumTarget) => {
      if (hitTargets.has(target.id)) return

      setHitTargets(new Set([target.id]))
      playSound(target.sound, target.label)
      sendAndClearSamplesForTarget(target.id)

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
      advanceTimeoutRef.current = setTimeout(() => {
        setCurrentTargetIndex((prev) => prev + 1)
      }, 150)
    },
    [hitTargets, playSound, sendAndClearSamplesForTarget]
  )

  const currentTarget =
    currentTargetIndex >= 0 && currentTargetIndex < DRUM_TARGETS.length
      ? DRUM_TARGETS[currentTargetIndex]
      : null

  useEffect(() => {
    setHitTargets(new Set())
    dwellStartRef.current = null
    setIsGazeInsideBlue(false)
  }, [currentTargetIndex])

  useEffect(() => {
    if (!isPlaying || !gaze || !currentTarget) return
    if (!drumContainerRef.current) return

    // 타겟 원 중심(컨테이너 px) -> 뷰포트 px
    const { x: cxLocal, y: cyLocal } = getTargetCenterPx(currentTarget)
    const rect = drumContainerRef.current.getBoundingClientRect()
    const targetCxPx = rect.left + cxLocal
    const targetCyPx = rect.top + cyLocal

    // 시선 좌표는 뷰포트 정규화(0~1)로 들어오므로 px로 변환
    const gazePxX = gaze.x * window.innerWidth
    const gazePxY = gaze.y * window.innerHeight

    const distPx = Math.sqrt((gazePxX - targetCxPx) ** 2 + (gazePxY - targetCyPx) ** 2)
    const now = Date.now()

    const isInside = distPx <= BLUE_TARGET_RADIUS_PX
    setIsGazeInsideBlue(isInside)

    if (isInside) {
      if (dwellStartRef.current === null) dwellStartRef.current = now
      if (now - dwellStartRef.current >= GAZE_DWELL_MS) {
        handleTargetHit(currentTarget)
        dwellStartRef.current = null
      }
    } else {
      dwellStartRef.current = null
    }
  }, [gaze?.x, gaze?.y, isPlaying, currentTarget, handleTargetHit])

  useEffect(() => {
    if (!isPlaying || !gaze || !currentTarget) return
    const { x: cx, y: cy } = getTargetCenterPx(currentTarget)
    // 샘플 전송은 기존과 동일하게 "드럼 컨테이너 기준 정규화"로 유지
    const t = { x: cx / DRUM_CONTAINER.width, y: cy / DRUM_CONTAINER.height }
    samplesRef.current.push({
      targetId: currentTarget.id,
      targetX: t.x,
      targetY: t.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isPlaying, currentTarget])

  const getKeyStyle = (target: DrumTarget) => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      background: "#eaeaea",
      fontSize: "1.5em",
      height: 42,
      width: 42,
      textAlign: "center",
      borderRadius: 4,
      border: "3px solid #aaa",
      color: "#444",
      boxShadow: "1px 1px 1px rgba(0,0,0,.65)",
      zIndex: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      transition: "all ease-in-out .042s",
      userSelect: "none",
    }

    if (playingKeys.has(target.label)) baseStyle.transform = "scale(1.12)"
    return { ...baseStyle, ...target.style }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="absolute top-6 left-8 z-10">
        <h1 className="text-4xl font-bold text-black">드럼 연주</h1>
        <p className="text-xl text-gray-600 mt-2">파란 원을 따라 연주하세요!</p>
      </div>

      <div className="relative w-full h-screen flex items-center justify-center">
        <div
          ref={drumContainerRef}
          className="relative"
          style={{ width: DRUM_CONTAINER.width, height: DRUM_CONTAINER.height }}
        >
          <img
            src="https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/img/crash.png"
            alt="Crash cymbal"
            style={{
              position: "absolute",
              top: 114,
              left: 80,
              transform: "rotate(-7.2deg) scale(1.5)",
              transition: "all ease-in-out .042s",
            }}
          />
          <img
            src="https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/img/hihat-top.png"
            alt="Hi Hat cymbal"
            style={{
              position: "absolute",
              top: 166,
              right: 71,
              transform: "scale(1.35)",
              zIndex: 0,
              transition: "all ease-in-out .042s",
            }}
          />
          <img
            src="https://raw.githubusercontent.com/ArunMichaelDsouza/javascript-30-course/master/src/01-javascript-drum-kit/img/drum-kit.png"
            alt="Drum Kit"
            style={{ width: "100%", height: DRUM_CONTAINER.height, position: "relative" }}
          />

          {DRUM_TARGETS.map((target) => (
            <div key={target.id} style={getKeyStyle(target)}>
              {target.label}
            </div>
          ))}

          {isPlaying && currentTarget && (
            <div
              className="rounded-full border-4 border-[#0566FF] bg-[#0566FF]/20 cursor-pointer"
              style={{
                position: "absolute",
                width: 70,
                height: 70,
                top: currentTarget.style.top + 21,
                left: currentTarget.style.left !== undefined ? currentTarget.style.left + 21 : undefined,
                right:
                  currentTarget.style.right !== undefined
                    ? currentTarget.style.right - 21 + 42
                    : undefined,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 30px rgba(5, 102, 255, 0.6)",
                zIndex: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={() => handleTargetHit(currentTarget)}
            >
              <div className="absolute inset-0 rounded-full border-2 border-[#0566FF] animate-ping" />
              <div className="absolute inset-2 rounded-full bg-[#0566FF]/30" />
            </div>
          )}

          {/* 시선이 파란 타겟 안에 들어오면 초록 원 표시 */}
          {isPlaying && currentTarget && isGazeInsideBlue && (
            <div
              className="rounded-full bg-green-500/25 border-2 border-green-500 pointer-events-none"
              style={{
                position: "absolute",
                width: 60,
                height: 60,
                top: currentTarget.style.top + 21,
                left: currentTarget.style.left !== undefined ? currentTarget.style.left + 21 : undefined,
                right: currentTarget.style.right !== undefined ? currentTarget.style.right - 21 + 42 : undefined,
                transform: "translate(-50%, -50%)",
                zIndex: 31,
                boxShadow: "0 0 18px rgba(34, 197, 94, 0.5)",
              }}
            />
          )}

          {Array.from(hitTargets).map((targetId) => {
            const target = DRUM_TARGETS.find((t) => t.id === targetId)
            if (!target) return null
            if (currentTarget && currentTarget.id > targetId) return null
            return (
              <div
                key={targetId}
                className="rounded-full bg-green-500/30 border-2 border-green-500"
                style={{
                  position: "absolute",
                  width: 60,
                  height: 60,
                  top: target.style.top + 21,
                  left: target.style.left !== undefined ? target.style.left + 21 : undefined,
                  right: target.style.right !== undefined ? target.style.right - 21 + 42 : undefined,
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                }}
              />
            )
          })}
        </div>
      </div>

      <NavigationButtons
        gaze={gaze}
        onNext={onNext}
        onPrevious={onPrevious}
        progress={progress}
      />
    </div>
  )
}

