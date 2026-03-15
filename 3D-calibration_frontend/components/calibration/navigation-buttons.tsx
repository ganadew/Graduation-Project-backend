"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import GazeDwellButton from "@/components/gaze-dwell-button"

interface NavigationButtonsProps {
  onNext: () => void
  onPrevious: () => void
  progress: number
  gaze?: { x: number; y: number } | null
  disablePrevious?: boolean
  disableNext?: boolean
}

export default function NavigationButtons({
  onNext,
  onPrevious,
  progress,
  gaze,
  disablePrevious = false,
  disableNext = false,
}: NavigationButtonsProps) {
  const [prevProgress, setPrevProgress] = useState(0)
  const [nextProgress, setNextProgress] = useState(0)
  const prevIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const FILL_DURATION = 2000
  const UPDATE_INTERVAL = 50
  const INCREMENT = (UPDATE_INTERVAL / FILL_DURATION) * 100

  const clearPrev = () => {
    if (prevIntervalRef.current) clearInterval(prevIntervalRef.current)
    prevIntervalRef.current = null
  }
  const clearNext = () => {
    if (nextIntervalRef.current) clearInterval(nextIntervalRef.current)
    nextIntervalRef.current = null
  }

  const handlePrevMouseEnter = () => {
    if (disablePrevious) return
    clearPrev()
    prevIntervalRef.current = setInterval(() => {
      setPrevProgress((prev) => {
        if (prev >= 100) {
          clearPrev()
          onPrevious()
          return 0
        }
        return prev + INCREMENT
      })
    }, UPDATE_INTERVAL)
  }

  const handlePrevMouseLeave = () => {
    clearPrev()
    setPrevProgress(0)
  }

  const handleNextMouseEnter = () => {
    if (disableNext) return
    clearNext()
    nextIntervalRef.current = setInterval(() => {
      setNextProgress((prev) => {
        if (prev >= 100) {
          clearNext()
          onNext()
          return 0
        }
        return prev + INCREMENT
      })
    }, UPDATE_INTERVAL)
  }

  const handleNextMouseLeave = () => {
    clearNext()
    setNextProgress(0)
  }

  useEffect(() => {
    return () => {
      clearPrev()
      clearNext()
    }
  }, [])

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-2 bg-gray-200 z-30">
        <div
          className="h-full bg-[#0566FF] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="fixed bottom-8 right-6 flex gap-4 z-30">
        <GazeDwellButton gaze={gaze ?? null} onDwellComplete={onPrevious} disabled={disablePrevious}>
          <button
            type="button"
            onClick={onPrevious}
            disabled={disablePrevious}
            onMouseEnter={handlePrevMouseEnter}
            onMouseLeave={handlePrevMouseLeave}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
              disablePrevious ? "bg-gray-100 opacity-60 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"
            }`}
            aria-label="이전"
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-[#0566FF]/30 transition-all"
              style={{ height: `${prevProgress}%` }}
            />
            <ChevronLeft className="w-12 h-12 text-black relative z-10" />
          </button>
        </GazeDwellButton>

        <GazeDwellButton gaze={gaze ?? null} onDwellComplete={onNext} disabled={disableNext}>
          <button
            type="button"
            onClick={onNext}
            disabled={disableNext}
            onMouseEnter={handleNextMouseEnter}
            onMouseLeave={handleNextMouseLeave}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden transition-colors ${
              disableNext ? "bg-[#0566FF]/40 opacity-70 cursor-not-allowed" : "bg-[#0566FF] hover:bg-[#0450CC]"
            }`}
            aria-label="다음"
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-white/30 transition-all"
              style={{ height: `${nextProgress}%` }}
            />
            <ChevronRight className="w-12 h-12 text-white relative z-10" />
          </button>
        </GazeDwellButton>
      </div>
    </>
  )
}

