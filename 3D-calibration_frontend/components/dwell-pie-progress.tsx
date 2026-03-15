"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface DwellPieProgressProps {
  /** Diameter of the pie overlay circle */
  size: number
  /** Time in ms to fill completely (default 2000 for gaze) */
  duration?: number
  /** Fill color */
  color?: string
  /** Opacity of the filled wedge (0-1) */
  fillOpacity?: number
  /** Called when the pie is fully filled */
  onDwellComplete: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  /** 시선 좌표 (0~1). 제공 시 마우스 대신 시선으로 dwell 감지 */
  gaze?: { x: number; y: number } | null
}

/**
 * A circular pie/wedge dwell progress indicator.
 * Renders a transparent circle overlay that fills clockwise like a pie chart
 * when the user hovers, triggering onDwellComplete when full.
 */
const GAZE_THRESHOLD = 0.04

export default function DwellPieProgress({
  size,
  duration = 2000,
  color = "#0566FF",
  fillOpacity = 0.35,
  onDwellComplete,
  children,
  className = "",
  disabled = false,
  gaze,
}: DwellPieProgressProps) {
  const [progress, setProgress] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const animRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const completedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const r = size / 2

  const isGazeOnTarget = useCallback(() => {
    if (!gaze || !containerRef.current) return false
    const rect = containerRef.current.getBoundingClientRect()
    const w = window.innerWidth
    const h = window.innerHeight
    const left = rect.left / w
    const right = rect.right / w
    const top = rect.top / h
    const bottom = rect.bottom / h
    const pad = GAZE_THRESHOLD
    return gaze.x >= left - pad && gaze.x <= right + pad && gaze.y >= top - pad && gaze.y <= bottom + pad
  }, [gaze?.x, gaze?.y])

  const startDwell = useCallback(() => {
    if (disabled) return
    setIsHovering(true)
    completedRef.current = false
    startTimeRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const p = Math.min(elapsed / duration, 1)
      setProgress(p)

      if (p >= 1 && !completedRef.current) {
        completedRef.current = true
        onDwellComplete()
        setTimeout(() => {
          setProgress(0)
          setIsHovering(false)
        }, 150)
        return
      }

      if (p < 1) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [duration, onDwellComplete, disabled])

  const stopDwell = useCallback(() => {
    setIsHovering(false)
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    setProgress(0)
  }, [])

  useEffect(() => {
    if (!gaze || disabled) return
    if (isGazeOnTarget()) {
      if (!isHovering) startDwell()
    } else {
      stopDwell()
    }
  }, [gaze?.x, gaze?.y, isGazeOnTarget, disabled, isHovering, startDwell, stopDwell])

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  // Build a pie wedge SVG path that sweeps from 12 o'clock clockwise
  const buildPiePath = (fraction: number): string => {
    if (fraction <= 0) return ""
    if (fraction >= 1) {
      // Full circle
      return `M ${r},${r} m 0,-${r} a ${r},${r} 0 1,1 0,${r * 2} a ${r},${r} 0 1,1 0,-${r * 2} Z`
    }

    const angle = fraction * 360
    const rad = ((angle - 90) * Math.PI) / 180
    const x = r + r * Math.cos(rad)
    const y = r + r * Math.sin(rad)
    const largeArc = angle > 180 ? 1 : 0

    // Arc from top center, sweeping clockwise
    return `M ${r},${r} L ${r},0 A ${r},${r} 0 ${largeArc},1 ${x},${y} Z`
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={!gaze ? startDwell : undefined}
      onMouseLeave={!gaze ? stopDwell : undefined}
    >
      {children}
      {/* Pie overlay */}
      {isHovering && progress > 0 && (
        <svg
          width={size}
          height={size}
          className="absolute inset-0 m-auto pointer-events-none z-20"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Background circle - subtle ring */}
          <circle
            cx={r}
            cy={r}
            r={r - 1}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.2}
          />
          {/* Filled pie wedge */}
          <path
            d={buildPiePath(progress)}
            fill={color}
            opacity={fillOpacity}
          />
        </svg>
      )}
    </div>
  )
}
