"use client"

import { useEffect, useRef } from "react"

interface GazePointerDispatcherProps {
  gaze: { x: number; y: number } | null
}

/**
 * Dispatches synthetic pointer/mouse events at gaze position.
 * Spline 및 기타 요소가 시선 위치에서 마우스가 있는 것처럼 인식하게 함.
 */
export default function GazePointerDispatcher({ gaze }: GazePointerDispatcherProps) {
  const lastGazeRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!gaze) return

    lastGazeRef.current = { x: gaze.x, y: gaze.y }
    const clientX = gaze.x * window.innerWidth
    const clientY = gaze.y * window.innerHeight

    const common = { clientX, clientY, bubbles: true, cancelable: true, view: window }

    // 1) document에 전달 (전역 리스너용)
    document.documentElement.dispatchEvent(
      new PointerEvent("pointermove", { ...common, pointerId: 1, isPrimary: true }),
    )
    document.documentElement.dispatchEvent(new MouseEvent("mousemove", common))

    // 2) 해당 좌표의 최상위 요소에 직접 전달 (GazeCursor는 pointer-events:none이라 Spline 캔버스가 선택됨)
    const el = document.elementFromPoint(clientX, clientY)
    if (el && el !== document.documentElement) {
      el.dispatchEvent(new PointerEvent("pointermove", { ...common, pointerId: 1 }))
      el.dispatchEvent(new MouseEvent("mousemove", common))
    }
  }, [gaze?.x, gaze?.y])

  return null
}
