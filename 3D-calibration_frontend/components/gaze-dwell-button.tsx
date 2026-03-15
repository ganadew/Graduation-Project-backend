"use client"

import DwellPieProgress from "@/components/dwell-pie-progress"

const DWELL_DURATION_MS = 2000

interface GazeDwellButtonProps {
  gaze: { x: number; y: number } | null
  onDwellComplete: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

/**
 * 시선으로 2초 이상 응시하면 클릭으로 처리. 원형 프로그레스 표시.
 */
export default function GazeDwellButton({
  gaze,
  onDwellComplete,
  children,
  className = "",
  disabled = false,
}: GazeDwellButtonProps) {
  return (
    <DwellPieProgress
      gaze={gaze}
      size={48}
      duration={DWELL_DURATION_MS}
      onDwellComplete={onDwellComplete}
      className={className}
      disabled={disabled}
    >
      {children}
    </DwellPieProgress>
  )
}
