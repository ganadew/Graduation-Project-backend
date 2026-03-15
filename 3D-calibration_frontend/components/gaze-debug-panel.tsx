"use client"

/**
 * 시선 좌표 디버그 패널 - 수신 여부 확인용
 */
interface GazeDebugPanelProps {
  gaze: { x: number; y: number } | null
  isConnected: boolean
}

export default function GazeDebugPanel({ gaze, isConnected }: GazeDebugPanelProps) {
  return (
    <div className="absolute bottom-24 left-8 z-30 rounded-lg bg-black/80 px-4 py-2 font-mono text-xs text-white">
      <div>연결: {isConnected ? "✓" : "✗"}</div>
      <div>
        시선: {gaze ? `(${gaze.x.toFixed(3)}, ${gaze.y.toFixed(3)})` : "수신 대기 중..."}
      </div>
    </div>
  )
}
