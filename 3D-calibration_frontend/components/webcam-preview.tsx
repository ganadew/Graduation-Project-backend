"use client"

import { useEffect, useRef, useState } from "react"

/**
 * 백엔드에서 WebSocket으로 전송하는 웹캠 프레임을 표시합니다.
 * 시선 추적용 얼굴 화면을 프론트엔드에 표시
 */
interface WebcamPreviewProps {
  frameData: string | null // base64 JPEG
  isConnected: boolean
  connectionError?: string | null
  className?: string
}

export default function WebcamPreview({
  frameData,
  isConnected,
  connectionError,
  className = "",
}: WebcamPreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    if (!frameData || !imgRef.current) return
    imgRef.current.src = `data:image/jpeg;base64,${frameData}`
  }, [frameData])

  return (
    <div
      className={`absolute z-30 overflow-hidden rounded-xl border-2 border-[#0566FF]/40 bg-black/80 shadow-xl ${className}`}
      style={{ right: 24, top: 24 }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/50">
        <span className="text-xs font-medium text-white/90">
          {isConnected
            ? "웹캠 (시선 추적 중)"
            : connectionError
              ? `연결 실패: ${connectionError}`
              : "백엔드 연결 대기..."}
        </span>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="text-white/70 hover:text-white text-xs"
          aria-label={showPreview ? "미리보기 숨기기" : "미리보기 보기"}
        >
          {showPreview ? "접기" : "펼치기"}
        </button>
      </div>
      {showPreview && (
        <div className="relative" style={{ width: 320, height: 240 }}>
          {frameData ? (
            <img
              ref={imgRef}
              alt="웹캠 얼굴 미리보기"
              className="w-full h-full object-cover"
              style={{ imageOrientation: "none" }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black/60 text-center text-white/60 text-sm">
              {isConnected ? (
                "영상 대기 중..."
              ) : (
                <>
                  <span>백엔드를 실행해주세요</span>
                  <span className="text-xs text-white/40">
                    cd backend && python core_only.py
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
