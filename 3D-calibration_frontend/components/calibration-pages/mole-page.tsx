"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import NavigationButtons from "@/components/calibration/navigation-buttons"

interface MolePageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
  onNext: () => void
  onPrevious: () => void
  progress: number
}

const HOLE_POSITIONS = [
  { id: 0, row: 0, col: 0 },
  { id: 1, row: 0, col: 1 },
  { id: 2, row: 0, col: 2 },
  { id: 3, row: 1, col: 0 },
  { id: 4, row: 1, col: 1 },
  { id: 5, row: 1, col: 2 },
  { id: 6, row: 2, col: 0 },
  { id: 7, row: 2, col: 1 },
  { id: 8, row: 2, col: 2 },
]

const POINT_DURATION_MS = 7000
const GAZE_DWELL_MS = 2000
// 두더지 구멍 타겟 반지름(px) 기반 판정
const HOLE_TARGET_RADIUS_PX = 60

export default function MolePage({ gaze, onSendSamples, onNext, onPrevious, progress }: MolePageProps) {
  const [activeMole, setActiveMole] = useState<number | null>(null)
  const [currentMoleIndex, setCurrentMoleIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [hitMoles, setHitMoles] = useState<Set<number>>(new Set())
  const [moleSequence, setMoleSequence] = useState<number[]>([])
  const [score, setScore] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const hasInitialized = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const samplesRef = useRef<
    { targetX: number; targetY: number; gazeX: number; gazeY: number; holeId: number }[]
  >([])
  const dwellStartRef = useRef<number | null>(null)

  const playHitSound = useCallback(() => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime)
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1)
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch {
      // ignore
    }
  }, [])

  const generateMoleSequence = useCallback(() => {
    const shuffled = [...Array(9).keys()].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 5)
  }, [])

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    setMoleSequence(generateMoleSequence())
  }, [generateMoleSequence])

  useEffect(() => {
    if (!isPlaying || moleSequence.length === 0) return

    if (currentMoleIndex >= moleSequence.length) {
      setIsPlaying(false)
      setActiveMole(null)
      setTimeout(() => onNext(), 1000)
      return
    }

    setActiveMole(moleSequence[currentMoleIndex])

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrentMoleIndex((prev) => prev + 1)
    }, POINT_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [currentMoleIndex, isPlaying, moleSequence, onNext])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    }
  }, [])

  const sendAndClearSamplesForHole = useCallback(
    (holeId: number) => {
      const toSend = samplesRef.current
        .filter((s) => s.holeId === holeId)
        .map(({ targetX, targetY, gazeX, gazeY }) => ({ targetX, targetY, gazeX, gazeY }))
      if (toSend.length > 0) onSendSamples(toSend, "mole")
      samplesRef.current = samplesRef.current.filter((s) => s.holeId !== holeId)
    },
    [onSendSamples]
  )

  const handleMoleHit = useCallback(
    (holeId: number) => {
      if (activeMole !== holeId) return
      if (hitMoles.has(holeId)) return

      setHitMoles((prev) => new Set([...prev, holeId]))
      setScore((prev) => prev + 1)
      playHitSound()
      sendAndClearSamplesForHole(holeId)

      // 인식되면 바로 다음 두더지로 진행
      dwellStartRef.current = null
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
      advanceTimeoutRef.current = setTimeout(() => {
        setCurrentMoleIndex((prev) => prev + 1)
      }, 150)
    },
    [activeMole, hitMoles, playHitSound, sendAndClearSamplesForHole]
  )

  useEffect(() => {
    if (!isPlaying || !gaze || activeMole === null) return
    if (!boardRef.current) return

    const hole = HOLE_POSITIONS.find((h) => h.id === activeMole)
    if (!hole) return

    const rect = boardRef.current.getBoundingClientRect()
    const centerPxX = rect.left + ((hole.col + 0.5) / 3) * rect.width
    const centerPxY = rect.top + ((hole.row + 0.5) / 3) * rect.height

    const gazePxX = gaze.x * window.innerWidth
    const gazePxY = gaze.y * window.innerHeight

    const distPx = Math.sqrt((gazePxX - centerPxX) ** 2 + (gazePxY - centerPxY) ** 2)
    const now = Date.now()
    if (distPx <= HOLE_TARGET_RADIUS_PX) {
      if (dwellStartRef.current === null) dwellStartRef.current = now
      if (now - dwellStartRef.current >= GAZE_DWELL_MS) {
        handleMoleHit(activeMole)
        dwellStartRef.current = null
      }
    } else {
      dwellStartRef.current = null
    }
  }, [gaze?.x, gaze?.y, isPlaying, activeMole, handleMoleHit])

  useEffect(() => {
    if (!isPlaying || !gaze || activeMole === null) return
    const hole = HOLE_POSITIONS.find((h) => h.id === activeMole)
    if (!hole) return
    // 샘플 전송은 기존과 동일하게 3x3 그리드 기준 정규화 좌표로 유지
    const c = {
      x: (hole.col + 0.5) / 3,
      y: (hole.row + 0.5) / 3,
    }
    samplesRef.current.push({
      holeId: activeMole,
      targetX: c.x,
      targetY: c.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isPlaying, activeMole])

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute top-6 left-8 z-10">
        <h1 className="text-4xl font-bold text-black">두더지 잡기</h1>
        <p className="text-xl text-gray-600 mt-2">튀어나오는 두더지를 따라가세요!</p>
      </div>

      <div className="relative w-full h-screen flex items-center justify-center">
        <div
          ref={boardRef}
          className="relative bg-[#8B9A46] rounded-3xl p-8"
          style={{ width: 600, height: 500 }}
        >
          <div className="grid grid-cols-3 gap-8 h-full">
            {HOLE_POSITIONS.map((hole) => (
              <div key={hole.id} className="relative flex items-center justify-center">
                <div
                  className={`relative w-28 h-28 rounded-full cursor-pointer transition-all duration-200
                    ${
                      activeMole === hole.id
                        ? "bg-[#4A3728] border-4 border-[#0566FF] shadow-lg shadow-[#0566FF]/50"
                        : "bg-[#2D2015] border-4 border-[#5C4A3A]"
                    }
                    ${hitMoles.has(hole.id) && activeMole === hole.id ? "bg-green-600 border-green-400" : ""}
                  `}
                  onMouseEnter={() => handleMoleHit(hole.id)}
                >
                  {activeMole === hole.id && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${
                        hitMoles.has(hole.id) ? "scale-0" : "scale-100 animate-bounce"
                      }`}
                    >
                      <div className="w-20 h-20 bg-[#8B6914] rounded-full relative">
                        <div className="absolute top-4 left-3 w-4 h-4 bg-white rounded-full">
                          <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" />
                        </div>
                        <div className="absolute top-4 right-3 w-4 h-4 bg-white rounded-full">
                          <div className="absolute top-1 left-1 w-2 h-2 bg-black rounded-full" />
                        </div>
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#FF9999] rounded-full" />
                        <div className="absolute top-12 left-2 w-3 h-2 bg-[#FFB6C1] rounded-full opacity-60" />
                        <div className="absolute top-12 right-2 w-3 h-2 bg-[#FFB6C1] rounded-full opacity-60" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 활성 두더지 구멍 위에 7초 동안 떠 있는 파란 타겟 원 */}
          {isPlaying && activeMole !== null && boardRef.current && (() => {
            const hole = HOLE_POSITIONS.find((h) => h.id === activeMole)
            if (!hole) return null
            const rect = boardRef.current.getBoundingClientRect()
            const centerPxX = ((hole.col + 0.5) / 3) * rect.width
            const centerPxY = ((hole.row + 0.5) / 3) * rect.height
            return (
              <div
                className="pointer-events-none rounded-full border-4 border-[#0566FF] bg-[#0566FF]/15"
                style={{
                  position: "absolute",
                  width: HOLE_TARGET_RADIUS_PX * 2,
                  height: HOLE_TARGET_RADIUS_PX * 2,
                  left: centerPxX,
                  top: centerPxY,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 30px rgba(5,102,255,0.6)",
                  zIndex: 20,
                }}
              >
                <div className="absolute inset-1 rounded-full border-2 border-[#0566FF] animate-ping" />
              </div>
            )
          })()}

          <div className="absolute top-4 right-4 bg-white/90 px-4 py-2 rounded-xl">
            <span className="text-lg font-bold text-black">
              {score} / {moleSequence.length}
            </span>
          </div>
        </div>
      </div>

      <NavigationButtons gaze={gaze} onNext={onNext} onPrevious={onPrevious} progress={progress} />
    </div>
  )
}

