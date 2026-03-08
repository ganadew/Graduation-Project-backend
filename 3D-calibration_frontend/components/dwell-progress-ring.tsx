"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface DwellProgressRingProps {
  size: number
  strokeWidth?: number
  duration?: number
  splitColor?: boolean
  color?: string
  bgColor?: string
  onDwellComplete: () => void
  /** Called when the first half (yellow) of a split ring completes */
  onHalfComplete?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export default function DwellProgressRing({
  size,
  strokeWidth = 3,
  duration = 1200,
  splitColor = false,
  color = "#00B550",
  bgColor = "#e5e7eb",
  onDwellComplete,
  onHalfComplete,
  children,
  className = "",
  disabled = false,
}: DwellProgressRingProps) {
  const [progress, setProgress] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const animRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const completedRef = useRef(false)
  const halfFiredRef = useRef(false)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const startDwell = useCallback(() => {
    if (disabled) return
    setIsHovering(true)
    completedRef.current = false
    halfFiredRef.current = false
    startTimeRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current

      let p: number
      if (splitColor) {
        // First half (yellow) takes 50% of duration, second half (green) takes 80% of duration (slower)
        const yellowDuration = duration * 0.5
        const greenDuration = duration * 0.8
        if (elapsed <= yellowDuration) {
          p = (elapsed / yellowDuration) * 0.5
        } else {
          const greenElapsed = elapsed - yellowDuration
          p = 0.5 + (greenElapsed / greenDuration) * 0.5
        }
        p = Math.min(p, 1)
      } else {
        p = Math.min(elapsed / duration, 1)
      }

      setProgress(p)

      // Fire half complete callback for split color
      if (splitColor && p >= 0.5 && !halfFiredRef.current) {
        halfFiredRef.current = true
        onHalfComplete?.()
      }

      if (p >= 1 && !completedRef.current) {
        completedRef.current = true
        onDwellComplete()
        setTimeout(() => {
          setProgress(0)
          setIsHovering(false)
        }, 200)
        return
      }

      if (p < 1) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [duration, onDwellComplete, onHalfComplete, disabled, splitColor])

  const stopDwell = useCallback(() => {
    setIsHovering(false)
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    // Don't reset if half completed for split mode -- let parent decide
    setProgress(0)
    halfFiredRef.current = false
  }, [])

  // Expose progress for parent usage
  const getProgress = useCallback(() => progress, [progress])

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  const dashOffset = circumference * (1 - progress)

  const renderSplitArcs = () => {
    const halfCircumference = circumference / 2
    if (progress <= 0) return null
    if (progress <= 0.5) {
      const yellowDash = circumference * progress
      return (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFD400"
          strokeWidth={strokeWidth}
          strokeDasharray={`${yellowDash} ${circumference - yellowDash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: "none" }}
        />
      )
    } else {
      const greenDash = circumference * (progress - 0.5)
      return (
        <>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#FFD400"
            strokeWidth={strokeWidth}
            strokeDasharray={`${halfCircumference} ${halfCircumference}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#00B550"
            strokeWidth={strokeWidth}
            strokeDasharray={`${greenDash} ${circumference - greenDash}`}
            strokeDashoffset={circumference / 4 - halfCircumference}
            strokeLinecap="round"
            style={{ transition: "none" }}
          />
        </>
      )
    }
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={startDwell}
      onMouseLeave={stopDwell}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        style={{ pointerEvents: "none" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isHovering ? bgColor : "transparent"}
          strokeWidth={strokeWidth}
          opacity={0.4}
        />
        {splitColor ? (
          renderSplitArcs()
        ) : (
          progress > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: "none" }}
            />
          )
        )}
      </svg>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
