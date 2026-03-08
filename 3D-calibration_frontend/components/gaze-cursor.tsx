"use client"

/**
 * 시선 위치에 커스텀 커서를 표시합니다.
 * 시선 = 마우스 (아이마우스) 역할
 * pointer-events: none으로 아래 요소가 포인터 이벤트를 받을 수 있음
 */
interface GazeCursorProps {
  gaze: { x: number; y: number } | null
  visible?: boolean
}

export default function GazeCursor({ gaze, visible = true }: GazeCursorProps) {
  if (!gaze || !visible) return null

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[9999] transition-none"
      style={{
        left: `${gaze.x * 100}vw`,
        top: `${gaze.y * 100}vh`,
        transform: "translate(-50%, -50%)",
        willChange: "transform",
      }}
      aria-hidden
    >
      {/* 레이저 빔 스타일: 빨간 점 + 빔 꼬리 */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ width: 48, height: 48 }}
      >
        {/* 빔 글로우 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
          style={{
            width: 36,
            height: 36,
            background: "radial-gradient(circle, rgba(255,80,80,0.8) 0%, rgba(255,50,50,0.3) 40%, transparent 70%)",
            boxShadow: "0 0 20px 8px rgba(255,80,80,0.4)",
          }}
        />
        {/* 외곽 링 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
          style={{ width: 22, height: 22 }}
        />
        {/* 핵심 레이저 점 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(255,80,80,0.9)]"
          style={{ width: 10, height: 10 }}
        />
      </div>
    </div>
  )
}
