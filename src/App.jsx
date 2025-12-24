import React, { useState, useEffect, useRef } from 'react';
import EyeController from './components/EyeController';
import Calibration from './components/Calibration';
import './App.css';

function App() {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  // 시선 고정 관련 상태
  const [isGazeLocked, setIsGazeLocked] = useState(false);
  const [lockedGaze, setLockedGaze] = useState(null);
  const [lockedButton, setLockedButton] = useState(null);
  const fixationRef = useRef({ targetId: null, startTime: null });
  
  // EAR 값을 저장할 상태
  const [currentEAR, setCurrentEAR] = useState(0);
  // ★ 보정 완료 여부 상태 (false면 보정화면, true면 메인화면)
  const [isCalibrated, setIsCalibrated] = useState(false);

  const resetCalibration = () => {
    setIsCalibrated(false);
    setIsMenuOpen(false);
    setHoveredButton(null);
    setIsGazeLocked(false);
    setLockedButton(null);
    setLockedGaze(null);
    fixationRef.current = { targetId: null, startTime: null };
  };

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

    // 이미 어떤 버튼에 시선이 고정된 상태면, 더 이상 후보를 바꾸지 않음
    if (isGazeLocked && lockedButton) {
      setHoveredButton(lockedButton);
      return;
    }

    let candidateId = null;

    if (!isMenuOpen) {
      const centerBtn = document.getElementById('center-btn');
      if (centerBtn && isLookingAt(centerBtn, gaze)) {
        candidateId = 'center';
      }
    } else {
      menuItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && isLookingAt(el, gaze)) {
          candidateId = item.id;
        }
      });
    }

    const now = Date.now();

    if (!candidateId) {
      // 아무 버튼도 보고 있지 않으면 초기화
      setHoveredButton(null);
      fixationRef.current = { targetId: null, startTime: null };
      return;
    }

    // 새 버튼으로 시선이 옮겨진 경우: 타이머 리셋
    if (fixationRef.current.targetId !== candidateId) {
      fixationRef.current = { targetId: candidateId, startTime: now };
      setHoveredButton(candidateId);
      return;
    }

    // 같은 버튼을 계속 보고 있는 경우: 0.5초 이상 응시하면 시선/버튼 고정
    const duration = now - fixationRef.current.startTime;
    setHoveredButton(candidateId);

    if (duration >= 500 && !isGazeLocked) {
      setIsGazeLocked(true);
      setLockedButton(candidateId);
      setLockedGaze(gaze); // 현재 시선 좌표를 고정
    }
  }, [gaze, isMenuOpen, isCalibrated, isGazeLocked, lockedButton, menuItems]);

  const isLookingAt = (element, coords) => {
    const rect = element.getBoundingClientRect();
    return (
      coords.x >= rect.left &&
      coords.x <= rect.right &&
      coords.y >= rect.top &&
      coords.y <= rect.bottom
    );
  };

  // 선택되었을 때(깜빡임) 텍스트를 읽어주는 TTS 함수
  const speakText = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleBlink = () => {
    if (!isCalibrated) return;

    // 버튼에 시선이 고정된 상태에서만 실행
    if (!isGazeLocked || !hoveredButton) return;

    if (hoveredButton === 'center') {
      setIsMenuOpen(true);
      // 중앙 버튼을 보고 깜빡여서 메뉴를 열었을 때 안내 음성
      speakText('메뉴를 엽니다');
    } else if (isMenuOpen && hoveredButton) {
      const selected = menuItems.find(i => i.id === hoveredButton);
      if (selected) {
        // 메뉴 선택 시 해당 문구를 음성으로 출력
        speakText(selected.label);
        alert(`${selected.action} 실행!`);
        if (selected.action === 'Close') setIsMenuOpen(false);
      }
    }

    // 깜빡임 처리 후 시선 고정 해제
    setIsGazeLocked(false);
    setLockedButton(null);
    setLockedGaze(null);
    fixationRef.current = { targetId: null, startTime: null };
  };

  return (
    <div className="App">
      {/* 1. EyeController는 항상 켜져 있어야 보정 데이터가 쌓임 */}
      <EyeController 
        onGazeChange={setGaze} 
        onBlink={handleBlink} 
        onEarChange={setCurrentEAR} 
      />

      <div
        className="gaze-point"
        style={{
          left: (isGazeLocked && lockedGaze ? lockedGaze.x : gaze.x),
          top: (isGazeLocked && lockedGaze ? lockedGaze.y : gaze.y),
        }}
      />

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
            {/* 보정 다시하기 버튼 (항상 표시) */}
            {isCalibrated && (
              <button
                className="recalibrate-btn"
                onClick={resetCalibration}
                aria-label="캘리브레이션 다시 하기"
              >
                ← 캘리브레이션 다시 하기
              </button>
            )}

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
              <div className="menu-with-back">
                <button
                  className="back-btn"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="이전 화면으로"
                >
                  ← 이전
                </button>
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
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;