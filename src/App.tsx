import { useRef, useState } from "react";
import { useBlinkDetector } from "./useBlinkDetector.ts";

export default function App() {
  // 콜백 ref로 비디오 엘리먼트를 state에 고정
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // 상태
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false); // 곰 위젯 hover 상태
  const [ear, setEAR] = useState<number | null>(null);
  const [blinkHint, setBlinkHint] = useState(false);

  // 중복 토글 방지
  const lastToggleRef = useRef(0);
  const COOLDOWN = 350;

  // 깜빡임 처리: "닫기"는 어디서든, "열기"는 hover 상태에서만
  useBlinkDetector({
    video: videoEl,
    onBlink: () => {
      const now = performance.now();
      if (now - lastToggleRef.current < COOLDOWN) return;
      lastToggleRef.current = now;

      setBlinkHint(true);
      setTimeout(() => setBlinkHint(false), 180);

      setMenuOpen(prev => (prev ? false : hover ? true : false));
    },
    closeThresh: 0.20,
    openThresh: 0.25,
    minCloseMs: 120,
    onMetrics: (e) => setEAR(e),
  });

  const items = ["Left-click","Right-click","Double-click","Scroll","Click & Drag","Keyboard"];

  // ✅ 카메라 PiP 사이즈 & 위치(좌상단)
  const CAM_W = 320;
  const CAM_H = 240;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 30%, #f8fbff 0%, #eef4ff 40%, #eaf0ff 100%)",
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      {/* 📷 카메라 프리뷰: 좌상단 PiP */}
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          left: 16,
          top: 16,
          width: CAM_W,
          height: CAM_H,
          objectFit: "cover",
          transform: "scaleX(-1)",
          borderRadius: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.35)",
          border: "1px solid rgba(0,0,0,.08)",
          zIndex: 5,
          background: "#000",
        }}
      />

      {/* 상단 안내 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 24,
          transform: "translateX(-50%)",
          color: "#0b1120",
          fontWeight: 800,
          fontSize: 20,
          zIndex: 20,
          textShadow: "0 1px 0 rgba(255,255,255,.6)",
        }}
      >
        눈을 깜빡이면 메뉴가 {menuOpen ? "닫힙니다" : (hover ? "열립니다" : "열립니다 (곰 아이콘 위에서)")}
      </div>

      {/* EAR / Blink 힌트 (카메라 아래쪽에 맞춰 배치) */}
      <div
        style={{
          position: "fixed",
          left: 16,
          top: 16 + CAM_H + 12,
          color: "#304266",
          fontWeight: 800,
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,.85)",
          border: "1px solid rgba(0,0,0,.06)",
          boxShadow: "0 6px 20px rgba(23,40,70,.10)",
          zIndex: 15,
        }}
      >
        EAR: {ear ? ear.toFixed(3) : "…"} {blinkHint ? "👁️" : ""}
      </div>

      {/* ⛳ 곰 위젯 버튼 (닫혀 있을 때만 렌더링 → hover 게이트) */}
      {!menuOpen && (
        <button
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 176, height: 176,
            borderRadius: "50%",
            border: hover ? "3px solid #ff7a7a" : "2px dashed #b7c6e6",
            background: hover
              ? "radial-gradient(circle at 50% 40%, #fff0f3, #ffe3e9)"
              : "radial-gradient(circle at 50% 40%, #e8f3ff, #d9e8ff)",
            boxShadow: hover
              ? "0 0 36px rgba(255, 90, 90, .40), inset 0 0 6px rgba(255,140,140,.75)"
              : "0 0 18px rgba(76,140,255,.25)",
            cursor: "default",
            zIndex: 10,
          }}
          aria-label="bear-widget"
        >
          <div
            style={{
              fontSize: 72,
              lineHeight: 1,
              filter: hover ? "drop-shadow(0 6px 10px rgba(255,120,120,.35))" : "none",
              userSelect: "none",
            }}
          >
            🐻
          </div>
          <div
            style={{
              marginTop: 8, fontSize: 14,
              color: hover ? "#d14545" : "#6d7da8", fontWeight: 700,
            }}
          >
            {hover ? "깜빡이면 메뉴 열림" : "마우스를 올려보세요"}
          </div>
        </button>
      )}

      {/* 원형 메뉴 (열림 상태) */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 520, height: 520,
            pointerEvents: "none",
            zIndex: 12,
          }}
        >
          {items.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 6;
            const R = 200;
            const w = 180, h = 96;
            const x = Math.cos(angle) * R + 260 - w / 2;
            const y = Math.sin(angle) * R + 260 - h / 2;
            return (
              <div
                key={label}
                style={{
                  position: "absolute",
                  left: x, top: y, width: w, height: h,
                  borderRadius: 20,
                  background: "rgba(255,255,255,.95)",
                  boxShadow: "0 20px 50px rgba(0,0,0,.35)",
                  border: "1px solid rgba(255,255,255,.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 900, color: "#0b1120",
                }}
              >
                {label}
              </div>
            );
          })}
          {/* 중앙 곰 (연출용) */}
          <div
            style={{
              position: "absolute",
              left: 260 - 56, top: 260 - 56,
              width: 112, height: 112, borderRadius: "50%",
              background: "rgba(255,255,255,.95)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              border: "1px solid rgba(255,255,255,.6)",
              transform: blinkHint ? "scale(1.08)" : "scale(1)",
              transition: "transform 120ms ease",
            }}
            aria-label="bear"
          >
            <div style={{ fontSize: 56, lineHeight: 1, userSelect: "none" }}>🐻</div>
          </div>
        </div>
      )}
    </div>
  );
}
