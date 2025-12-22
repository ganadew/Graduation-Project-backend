import { useEffect, useRef, useState } from "react";
import { useBlinkDetector } from "./useBlinkDetector";

declare global {
  interface Window {
    webgazer: any;
  }
}

type Pt = { x: number; y: number };

export default function GazeDemo() {
  const [pos, setPos] = useState<Pt | null>(null);
  const [ready, setReady] = useState(false);
  const [ear, setEar] = useState<number | null>(null); // EAR 상태

  const dotRef = useRef<HTMLDivElement | null>(null);
  const laserRef = useRef<HTMLDivElement | null>(null);

  // 중앙 위젯 (원형 영역)
  const WIDGET = { r: 88 };
  const cx = () => window.innerWidth / 2;
  const cy = () => window.innerHeight / 2;

  const insideWidget = (p: Pt | null) => {
    if (!p) return false;
    const dx = p.x - cx();
    const dy = p.y - cy();
    return Math.hypot(dx, dy) <= WIDGET.r;
  };

  // 메뉴 오픈 상태 (깜빡임으로)
  const [open, setOpen] = useState(false);

  // ---- WebGazer 로드/시작 ----
  useEffect(() => {
    let cancelled = false;

    const load = () =>
      new Promise<void>((res, rej) => {
        if (window.webgazer) return res();
        const s = document.createElement("script");
        s.src = "/webgazer.js";
        s.async = true;
        s.onload = () => res();
        s.onerror = () => rej(new Error("webgazer.js 로드 실패"));
        document.head.appendChild(s);
      });

    (async () => {
      try {
        await load();
        if (cancelled) return;

        const wg = window.webgazer;
        wg.setRegression("ridge");
        try {
          wg.setTracker("TFFacemesh");
        } catch {
          wg.setTracker("clmtrackr");
        }
        if (wg.setSaveDataAcrossSessions) wg.setSaveDataAcrossSessions(true);

        wg
          .showVideoPreview(true)
          .showFaceOverlay(true)
          .showFaceFeedbackBox(true)
          .setGazeListener((data: any) => {
            if (!data) return;
            const p = { x: data.x as number, y: data.y as number };
            setPos(p);

            // 시선 점 이동
            if (dotRef.current) {
              const DOT = 14;
              dotRef.current.style.transform = `translate(${
                p.x - DOT / 2
              }px, ${p.y - DOT / 2}px)`;
            }

            // 레이저(센터 → 시선점)
            if (laserRef.current) {
              const cxv = cx();
              const cyv = cy();
              const dx = p.x - cxv;
              const dy = p.y - cyv;
              const len = Math.hypot(dx, dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              laserRef.current.style.width = `${len}px`;
              laserRef.current.style.transformOrigin = "0% 50%";
              laserRef.current.style.transform = `translate(${cxv}px, ${cyv}px) rotate(${angle}deg)`;
              laserRef.current.style.opacity = "1";
            }
          });

        await wg.begin();
        setReady(true);
      } catch (e) {
        console.error(e);
        alert("WebGazer 로드 실패: public/webgazer.js 확인");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- 깜빡임: 위젯 안일 때만 메뉴 열기 + EAR 값 받기 ----
  useBlinkDetector({
    onBlink: () => {
      console.log("BLINK 콜백 실행!");
      if (!insideWidget(pos)) return;
      setOpen(true);
      setTimeout(() => setOpen(false), 3000);
    },
    onEarChange: (v: number) => {
      setEar(v); // 화면 표시용 EAR 상태
    },
    closeThresh: 0.20,
    openThresh: 0.25,
    minCloseMs: 120,
    fps: 15,
  });

  const menuItems = [
    "Left-click",
    "Right-click",
    "Double-click",
    "Scroll",
    "Click & Drag",
    "Keyboard",
  ];

  const inWidget = insideWidget(pos);
  const eyeClosed = ear !== null && ear < 0.20;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#f7f9fc",
        overflow: "hidden",
      }}
    >
      {/* 상태 */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          fontWeight: 600,
        }}
      >
        {ready ? (inWidget ? "위젯: IN" : "위젯: OUT") : "초기화 중…"}
      </div>

      {/* EAR 디버그 표시 */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          textAlign: "right",
          fontWeight: 600,
        }}
      >
        <div>EAR: {ear !== null ? ear.toFixed(5) : "-"}</div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: eyeClosed ? "#e53935" : "#388e3c",
          }}
        >
          {ear === null
            ? "FACE: 없음"
            : eyeClosed
            ? "EYE: CLOSED"
            : "EYE: OPEN"}
        </div>
      </div>

      {/* 중앙 곰돌이 위젯 */}
      <div
        style={{
          position: "absolute",
          left: cx() - WIDGET.r,
          top: cy() - WIDGET.r,
          width: WIDGET.r * 2,
          height: WIDGET.r * 2,
          borderRadius: "50%",
          background: inWidget
            ? "radial-gradient(circle at 50% 40%, #fff0f3, #ffe3e9)"
            : "radial-gradient(circle at 50% 40%, #e8f3ff, #d9e8ff)",
          border: inWidget ? "3px solid #ff7a7a" : "2px dashed #b7c6e6",
          boxShadow: inWidget
            ? "0 0 36px rgba(255, 90, 90, .55), 0 0 6px rgba(255, 140, 140, .8) inset"
            : "0 0 20px rgba(76,140,255,.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 140ms ease",
        }}
        aria-label="gaze-widget"
      >
        {/* 곰돌이 SVG */}
        <svg width="72" height="72" viewBox="0 0 48 48" aria-hidden="true">
          <circle
            cx="14"
            cy="12"
            r="6"
            fill={inWidget ? "#ffd2d2" : "#dbe8ff"}
          />
          <circle
            cx="34"
            cy="12"
            r="6"
            fill={inWidget ? "#ffd2d2" : "#dbe8ff"}
          />
          <circle
            cx="24"
            cy="22"
            r="14"
            fill={inWidget ? "#fff" : "#ffffff"}
            stroke="#b9c6dd"
          />
          <circle cx="19.5" cy="20" r="2.2" fill="#1e2a44" />
          <circle cx="28.5" cy="20" r="2.2" fill="#1e2a44" />
          <ellipse
            cx="24"
            cy="26"
            rx="3.8"
            ry="3.0"
            fill="#ffe0e0"
            stroke="#e7b3b3"
          />
          <path
            d="M20,30 C22,32 26,32 28,30"
            stroke="#1e2a44"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 깜빡임으로 열리는 6개 메뉴 */}
      {open && (
        <div
          style={{
            position: "absolute",
            left: cx(),
            top: cy(),
            transform: "translate(-50%, -50%)",
            width: 420,
            height: 420,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        >
          {menuItems.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 6;
            const R = 170;
            const cardW = 150,
              cardH = 88;
            const x = Math.cos(angle) * R + 210 - cardW / 2;
            const y = Math.sin(angle) * R + 210 - cardH / 2;

            const centerX = cx() - 210 + x + cardW / 2;
            const centerY = cy() - 210 + y + cardH / 2;
            const hovered =
              pos && Math.hypot(pos.x - centerX, pos.y - centerY) < 80;

            return (
              <div
                key={label}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: cardW,
                  height: cardH,
                  borderRadius: 16,
                  background: hovered ? "#fff6f2" : "#fff",
                  border: "1px solid #e6eaf2",
                  boxShadow: hovered
                    ? "0 12px 32px rgba(255,120,60,.28)"
                    : "0 6px 18px rgba(23,40,70,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "#1b2a4a",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}

      {/* 레이저 (센터 → 시선점) */}
      <div
        ref={laserRef}
        style={{
          position: "absolute",
          height: 3,
          width: 0,
          borderRadius: 2,
          background:
            "linear-gradient(90deg, rgba(40,90,255,0.0) 0%, rgba(40,90,255,0.6) 60%, rgba(160,190,255,0.95) 100%)",
          boxShadow:
            "0 0 6px rgba(40,90,255,0.6), 0 0 16px rgba(80,130,255,0.4)",
          transform: "translate(-9999px,-9999px)",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {/* 시선 점 */}
      <div
        ref={dotRef}
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: inWidget
            ? "rgba(255,120,120,.95)"
            : "rgba(30,30,30,.9)",
          boxShadow: inWidget
            ? "0 0 10px rgba(255,90,90,.7), 0 0 20px rgba(255,160,160,.5)"
            : "0 0 10px rgba(0,0,0,.35)",
          pointerEvents: "none",
          transform: "translate(-9999px,-9999px)",
          transition:
            "transform 0.04s linear, background 140ms ease, box-shadow 140ms ease",
        }}
      />

      {/* 깜빡임 인식용 비디오 */}
      <video
        id="blinkVideo"
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          width: 220,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          background: "#000",
        }}
      />
    </div>
  );
}
