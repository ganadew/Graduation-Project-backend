import React, { useEffect, useState } from "react";
import "./RadialMenu.css";

const MENU_ITEMS = [
  { id: "left", label: "Left‑click", sub: "왼쪽" },
  { id: "right", label: "Right‑click", sub: "오른쪽" },
  { id: "double", label: "Double‑click", sub: "더블" },
  { id: "drag", label: "Click & Drag", sub: "드래그" },
  { id: "scroll", label: "Scroll", sub: "스크롤" },
  { id: "keyboard", label: "Keyboard", sub: "키보드" },
];

export default function RadialMenu() {
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleCenterClick = () => {
    // 디버그/백업용: 마우스로도 동작 확인 가능
    setOpen((prev) => !prev);
    if (open) {
      // 메뉴가 닫힐 때 선택 상태 초기화
      setSelectedItem(null);
    }
  };

  const handleItemClick = (itemId) => {
    setSelectedItem(itemId);
    console.log("[RADIAL] item selected:", itemId);
    // TODO: 실제 동작(왼쪽클릭, 스크롤 등)을 여기서 수행
  };

  // ✅ 백엔드(WebSocket)에서 오는 "blink" 이벤트로 토글
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8765");

    ws.onopen = () => {
      console.log("[WS] connected");
    };

    ws.onmessage = (event) => {
      const handleBlink = () => {
        const gaze = window.__gazePos;
        if (!gaze) return;

        const el = document.elementFromPoint(gaze.x, gaze.y);
        if (!el) return;

        const role = el.getAttribute("data-role") || el.closest("[data-role]")?.getAttribute("data-role");

        if (role === "radial-center") {
          // 중앙 원 위에서 깜빡이면 메뉴 열기/닫기 토글
          setOpen((prev) => !prev);
        } else if (role === "radial-item") {
          // 펼쳐진 메뉴 위에서 깜빡이면 그 메뉴 클릭으로 간주
          const target =
            el.getAttribute("data-item-id") ||
            el.closest("[data-item-id]")?.getAttribute("data-item-id");
          if (target) {
            handleItemClick(target);
          }
        }
      };

      try {
        // 새 버전(JSON)
        const data = JSON.parse(event.data);
        if (data.type === "blink") {
          handleBlink();
        }
      } catch (e) {
        // 예전 버전(문자열 "blink")도 지원
        if (event.data === "blink") {
          handleBlink();
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] error", err);
    };

    ws.onclose = () => {
      console.log("[WS] closed");
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="radial-root">
      {/* 중앙 캐릭터 / 트리거 버튼 */}
      <button
        type="button"
        className={`radial-center ${open ? "open" : ""}`}
        data-role="radial-center"
        onClick={handleCenterClick}
      >
        <div className="radial-center-inner">
          <span className="radial-center-icon">🐶</span>
        </div>
      </button>

      {/* 퍼져 나가는 6개 메뉴 카드 */}
      {MENU_ITEMS.map((item, index) => {
        const angle = (360 / MENU_ITEMS.length) * index;
        const isSelected = selectedItem === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`radial-item ${open ? "open" : ""} ${isSelected ? "selected" : ""}`}
            data-role="radial-item"
            data-item-id={item.id}
            style={{ "--angle": `${angle}deg` }}
            onClick={() => handleItemClick(item.id)}
          >
            <div className="radial-item-label">{item.label}</div>
            <div className="radial-item-sub">{item.sub}</div>
          </button>
        );
      })}
    </div>
  );
}