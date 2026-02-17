import React, { useState, useEffect } from 'react';
import EyeController from './components/EyeController';
import Calibration from './components/Calibration';
import GameCalibration3D from './components/GameCalibration3D';

import './App.css';

function App() {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [landmarks, setLandmarks] = useState(null);

  
  // EAR 값을 저장할 상태
  const [currentEAR, setCurrentEAR] = useState(0);
  // ★ 보정 완료 여부 상태 (false면 보정화면, true면 메인화면)
  const [isCalibrated, setIsCalibrated] = useState(false);

  const menuItems = [
    { id: 'menu1', label: '목말라요', action: 'Thirsty' },
    { id: 'menu2', label: '자세가 불편해요', action: 'Posture' },
    { id: 'menu3', label: '다리가 가려워요', action: 'Itchy' },
    { id: 'menu4', label: '소리 좀 키워주세요', action: 'Volume Up' },
    { id: 'menu5', label: '감사합니다', action: 'Thanks' },
    { id: 'menu6', label: '직접 입력', action: 'Type' },
  ];

  // 시선 감지 로직(기존과 동일)
  useEffect(() => {
    if (!isCalibrated) return;

    if (!isMenuOpen) {
      const centerBtn = document.getElementById('center-btn');
      if (centerBtn && isLookingAt(centerBtn, gaze)) {
        setHoveredButton('center');
        return;
      }
    } else {
      let found = null;
      menuItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && isLookingAt(el, gaze)) {
          found = item.id;
        }
      });
      setHoveredButton(found);
      return;
    }
    setHoveredButton(null);
  }, [gaze, isMenuOpen, isCalibrated]);

  const isLookingAt = (element, coords) => {
    const rect = element.getBoundingClientRect();
    return (
      coords.x >= rect.left &&
      coords.x <= rect.right &&
      coords.y >= rect.top &&
      coords.y <= rect.bottom
    );
  };

  const handleBlink = () => {
    if (!isCalibrated) return;

    if (hoveredButton === 'center') {
      setIsMenuOpen(true);
    } else if (isMenuOpen && hoveredButton) {
      const selected = menuItems.find(i => i.id === hoveredButton);
      if (selected) {
        alert(`${selected.action} 실행!`);
        if (selected.action === 'Close') setIsMenuOpen(false);
      }
    }
  };

  return (
    <div className="App">
      {/* 1. EyeController는 항상 켜져 있어야 보정 데이터가 쌓임 */}
      <EyeController 
        onGazeChange={setGaze} 
        onBlink={handleBlink} 
        onEarChange={setCurrentEAR} 
        onLandmarksChange={setLandmarks}
      />

      <div className="gaze-point" style={{ left: gaze.x, top: gaze.y }} />

      {/* 2. 보정이 안 끝났으면 Calibration 화면 표시 */}
      {!isCalibrated ? (
        <Calibration onComplete={() => setIsCalibrated(true)} />
      ) : (
        /* 3. 보정이 끝나면 기존 메인 화면 표시 */
        <>
          <div className="ear-display-box">
            EAR: <strong>{currentEAR.toFixed(3)}</strong>
          </div>

          <div className="main-container">
            {!isMenuOpen && (
              <div className="start-screen-layout">
                <h1 className="top-instruction">눈을 깜빡이면 메뉴가 열립니다</h1>
                <button
                  id="center-btn"
                  className={`circle-btn center ${hoveredButton === 'center' ? 'hovered' : ''}`}
                >
                  🐻
                  <span className="caption">깜빡이면 메뉴 열림</span>
                </button>
              </div>
            )}

            {isMenuOpen && (
              <div className="grid-menu-container">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    id={item.id}
                    className={`grid-btn ${hoveredButton === item.id ? 'hovered' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;