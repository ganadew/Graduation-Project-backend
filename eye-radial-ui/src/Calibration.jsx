import React, { useEffect, useState, useCallback } from "react";
import "./Calibration.css";

const CIRCLES_PER_PAGE = 30;
const TOTAL_CIRCLES = 60;
const TOTAL_PAGES = Math.ceil(TOTAL_CIRCLES / CIRCLES_PER_PAGE);

export default function Calibration({ onComplete }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [clickedCircles, setClickedCircles] = useState(new Set());
  const [allCompleted, setAllCompleted] = useState(false);

  // 현재 페이지의 원들
  const startIndex = currentPage * CIRCLES_PER_PAGE;
  const endIndex = Math.min(startIndex + CIRCLES_PER_PAGE, TOTAL_CIRCLES);
  const currentCircles = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i);

  // 그리드 배치를 위한 계산 (5x6 또는 6x5)
  const getGridPosition = (index) => {
    const cols = 6;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return { row, col };
  };

  const handleCircleClick = useCallback((circleId) => {
    setClickedCircles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(circleId)) {
        newSet.delete(circleId);
      } else {
        newSet.add(circleId);
      }
      return newSet;
    });
  }, []);

  const handleNextPage = useCallback(() => {
    if (currentPage < TOTAL_PAGES - 1) {
      setCurrentPage((prev) => prev + 1);
    } else if (allCompleted) {
      onComplete();
    }
  }, [currentPage, allCompleted, onComplete]);

  // WebSocket을 통한 눈깜빡임 처리
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8765");

    ws.onopen = () => {
      console.log("[CALIBRATION WS] connected");
    };

    ws.onmessage = (event) => {
      const handleBlink = () => {
        const gaze = window.__gazePos;
        if (!gaze) return;

        const el = document.elementFromPoint(gaze.x, gaze.y);
        if (!el) return;

        const circleId = el.getAttribute("data-circle-id");
        if (circleId) {
          const id = parseInt(circleId, 10);
          handleCircleClick(id);
        } else if (el.getAttribute("data-role") === "calibration-ok") {
          handleNextPage();
        }
      };

      try {
        const data = JSON.parse(event.data);
        if (data.type === "blink") {
          handleBlink();
        }
      } catch (e) {
        if (event.data === "blink") {
          handleBlink();
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[CALIBRATION WS] error", err);
    };

    ws.onclose = () => {
      console.log("[CALIBRATION WS] closed");
    };

    return () => {
      ws.close();
    };
  }, [handleCircleClick, handleNextPage]);

  // 페이지 완료 체크
  useEffect(() => {
    const currentPageCircles = currentCircles;
    const allClicked = currentPageCircles.every((id) => clickedCircles.has(id));
    
    if (allClicked && currentPageCircles.length > 0) {
      // 현재 페이지의 모든 원이 클릭되었는지 확인
      const timeout = setTimeout(() => {
        if (currentPage < TOTAL_PAGES - 1) {
          setCurrentPage((prev) => prev + 1);
          // 다음 페이지로 넘어갈 때 클릭 상태는 유지
        } else {
          // 모든 페이지 완료
          setAllCompleted(true);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [clickedCircles, currentPage, currentCircles]);

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="calibration-root">
      <div className="calibration-header">
        <div className="calibration-status">
          <div className="calibration-status-item status-ok" data-role="calibration-ok">
            OK
          </div>
          <div className="calibration-status-item status-error"></div>
        </div>
        <h1 className="calibration-title">시선 보정 (Calibration)</h1>
      </div>

      <div className="calibration-grid">
        {currentCircles.map((circleId, index) => {
          const { row, col } = getGridPosition(index);
          const isClicked = clickedCircles.has(circleId);
          return (
            <div
              key={circleId}
              className={`calibration-circle ${isClicked ? "clicked" : ""}`}
              data-circle-id={circleId}
              data-role="calibration-circle"
              onClick={() => handleCircleClick(circleId)}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
              }}
            >
              <span className="calibration-circle-number">{circleId}</span>
            </div>
          );
        })}
      </div>

      <div className="calibration-footer">
        <div className="calibration-progress">
          페이지 {currentPage + 1} / {TOTAL_PAGES} ({clickedCircles.size} / {TOTAL_CIRCLES} 완료)
        </div>
        <div className="calibration-actions">
          <button className="calibration-button skip" onClick={handleSkip}>
            건너뛰기
          </button>
          {allCompleted && (
            <button className="calibration-button complete" onClick={onComplete}>
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

