"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const HOLES: { x: number; y: number }[] = [
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.25, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.5 },
  { x: 0.25, y: 0.75 },
  { x: 0.5, y: 0.75 },
  { x: 0.75, y: 0.75 },
]
const NUM_MOLES = 5
const POINT_DURATION_MS = 7000
const GAZE_DWELL_MS = 2000
const GAZE_THRESHOLD = 0.08

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

interface WhackAMolePageProps {
  gaze: { x: number; y: number } | null
  onSendSamples: (
    samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
    source: string
  ) => void
}

export default function WhackAMolePage({ gaze, onSendSamples }: WhackAMolePageProps) {
  const [sequence, setSequence] = useState<number[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const samplesRef = useRef<{ targetX: number; targetY: number; gazeX: number; gazeY: number }[]>([])
  const gazeDwellStartRef = useRef<number | null>(null)
  const advancedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const advanceToNext = useCallback(
    (hole: { x: number; y: number }, idx: number, seq: number[]) => {
      if (advancedRef.current) return
      advancedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)

      const toSend = samplesRef.current.filter(
        (s) => s.targetX === hole.x && s.targetY === hole.y
      )
      if (toSend.length > 0) {
        onSendSamples(toSend, "whack_a_mole")
      }
      samplesRef.current = samplesRef.current.filter(
        (s) => !(s.targetX === hole.x && s.targetY === hole.y)
      )
      if (idx >= seq.length - 1) {
        setIsRunning(false)
      } else {
        setCurrentIdx(idx + 1)
        setProgress(0)
      }
      gazeDwellStartRef.current = null
    },
    [onSendSamples]
  )

  const start = useCallback(() => {
    const indices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, NUM_MOLES)
    setSequence(indices)
    setCurrentIdx(0)
    setIsRunning(true)
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
    if (!isRunning || sequence.length === 0) return
    advancedRef.current = false
    const holeIdx = sequence[currentIdx]
    const hole = HOLES[holeIdx]
    if (!hole) return

    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - startTime) / POINT_DURATION_MS) * 100))
    }, 100)

    timerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      advanceToNext(hole, currentIdx, sequence)
    }, POINT_DURATION_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [isRunning, currentIdx, sequence, advanceToNext])

  useEffect(() => {
    if (!isRunning || !gaze || sequence.length === 0) return
    const hole = HOLES[sequence[currentIdx]]
    if (!hole) return

    const dist = Math.sqrt((gaze.x - hole.x) ** 2 + (gaze.y - hole.y) ** 2)
    if (dist <= GAZE_THRESHOLD) {
      const now = Date.now()
      if (gazeDwellStartRef.current === null) {
        gazeDwellStartRef.current = now
      }
      if (now - gazeDwellStartRef.current >= GAZE_DWELL_MS) {
        advanceToNext(hole, currentIdx, sequence)
        return
      }
    } else {
      gazeDwellStartRef.current = null
    }
  }, [gaze?.x, gaze?.y, isRunning, currentIdx, sequence, advanceToNext])

  useEffect(() => {
    if (!isRunning || !gaze || sequence.length === 0) return
    const hole = HOLES[sequence[currentIdx]]
    if (!hole) return
    samplesRef.current.push({
      targetX: hole.x,
      targetY: hole.y,
      gazeX: gaze.x,
      gazeY: gaze.y,
    })
  }, [gaze?.x, gaze?.y, isRunning, currentIdx, sequence])

  const activeHole = isRunning && sequence.length > 0 ? HOLES[sequence[currentIdx]] : null

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <h2 className="text-xl font-semibold text-[#333] mb-2">두더지 잡기</h2>
      <p className="text-sm text-[#666] mb-6">
        두더지가 나오는 구멍을 따라가세요. (5마리, 각 7초) 2초 이상 응시하면 다음으로 넘어갑니다.
      </p>

      {isRunning ? (
        <div className="relative w-full max-w-md aspect-square grid grid-cols-3 gap-4 p-8">
          {HOLES.map((hole, i) => {
            const isActive =
              activeHole && hole.x === activeHole.x && hole.y === activeHole.y
            return (
              <div
                key={i}
                className="relative flex items-center justify-center rounded-full bg-[#2d5016] border-4 border-[#1a3009]"
                style={{
                  aspectRatio: "1",
                  boxShadow: "inset 0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {isActive && (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-3/4 rounded-t-full bg-[#8B4513] flex items-end justify-center pb-2"
                    style={{
                      boxShadow: "0 -2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-[#333]" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
      {isRunning && (
        <div className="mt-4 w-48">
          <div className="flex justify-between text-xs text-[#666] mb-1">
            <span>{currentIdx + 1} / {sequence.length}</span>
          </div>
          <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0566FF] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
