import React, { useEffect, useState } from "react";

export default function GazeCursor() {
  const [pos, setPos] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  // ✅ 백엔드에서 보내는 gaze(x,y)를 받아서 화면 좌표로 변환
  //    + 실패 대비용으로 마우스도 함께 추적
  useEffect(() => {
    let ws;

    try {
      ws = new WebSocket("ws://localhost:8765");
    } catch (e) {
      console.error("[WS][gaze] 연결 실패:", e);
    }

    if (ws) {
      ws.onopen = () => {
        console.log("[WS][gaze] connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "gaze") {
            const x = data.x * window.innerWidth;
            const y = data.y * window.innerHeight;
            const next = { x, y };
            setPos(next);
            window.__gazePos = next;
          }
        } catch (e) {
          // JSON이 아니면 무시
        }
      };

      ws.onerror = (err) => {
        console.error("[WS][gaze] error", err);
      };

      ws.onclose = () => {
        console.log("[WS][gaze] closed");
      };
    }

    // 마우스 이동을 항상 fallback 으로 사용 (디버그용)
    const handleMove = (e) => {
      const next = { x: e.clientX, y: e.clientY };
      setPos(next);
      window.__gazePos = next;
    };
    window.addEventListener("mousemove", handleMove);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="gaze-cursor" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      <div className="gaze-cursor-inner" />
    </div>
  );
}


