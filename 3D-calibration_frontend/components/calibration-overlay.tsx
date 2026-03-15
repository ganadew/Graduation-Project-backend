"use client"

/**
 * 5점 캘리브레이션 오버레이
 * 백엔드에서 calibration_show_point를 받아 화면에 보정 점 표시
 */
interface CalibrationOverlayProps {
  point: { index: number; normX: number; normY: number } | null
}

const CALIBRATION_LABELS = ["중심", "좌상", "우상", "좌하", "우하"]

export default function CalibrationOverlay({ point }: CalibrationOverlayProps) {
  if (!point) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9000] flex items-center justify-center">
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          left: `${point.normX * 100}%`,
          top: `${point.normY * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* 보정 점 표시 - 다이아몬드, 흰색, 외곽 블러 */}
        <div className="relative" style={{ width: 60, height: 60 }}>
          <div
            className="absolute inset-0 flex items-center justify-center bg-white shadow-[0_0_24px_8px_rgba(255,255,255,0.6)]"
            style={{
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              filter: "drop-shadow(0 0 12px rgba(255,255,255,0.8))",
            }}
          >
            <span className="text-lg font-bold text-[#1a1a2e] relative z-10">{point.index + 1}</span>
          </div>
          <div
            className="absolute inset-[-4px] animate-ping opacity-40"
            style={{
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              background: "rgba(255,255,255,0.5)",
              filter: "blur(4px)",
            }}
          />
        </div>
        <p className="mt-2 rounded bg-black/70 px-2 py-1 text-sm font-medium text-white">
          {CALIBRATION_LABELS[point.index] ?? `점 ${point.index + 1}`} - 시선을 맞춰주세요
        </p>
      </div>
    </div>
  )
}
