import React, { useState, useEffect, useRef } from 'react';
import EyeController from './components/EyeController';
import Calibration from './components/Calibration';
import './App.css';

const MENU_ITEMS = [
  { id: 'menu1', label: '물주세요', action: '물주세요' },
  { id: 'menu2', label: '배고파요', action: '배고파요' },
  { id: 'menu3', label: '화장실 갈래요', action: '화장실 갈래요' },
  { id: 'menu4', label: '고마워요', action: '고마워요' },
  { id: 'menu5', label: '미안해요', action: '미안해요' },
  { id: 'menu6', label: '기타', action: '기타' },
];

const HIT_PADDING = 120;  // 히트박스 넉넉하게
const DWELL_MS = 400;     // 0.4초만 봐도 확정 (줄임)
// 확정 후보는 다른 버튼을 CLEAR_MS 이상 봐야 해제됨 (눈 감는 순간 튀어도 유지)
const CLEAR_MS = 1000;

function App() {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [currentEAR, setCurrentEAR] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [confirmedTarget, setConfirmedTarget] = useState(null); // UI 표시용

  const confirmedTargetRef = useRef(null);
  const fixationRef = useRef({ targetId: null, startTime: null });
  const clearTimerRef = useRef(null); // 확정 후보 해제 타이머
  const isMenuOpenRef = useRef(false);

  useEffect(() => { isMenuOpenRef.current = isMenuOpen; }, [isMenuOpen]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(err => console.error('❌ Camera:', err));
  }, []);

  const isLookingAt = (element, coords, padding = HIT_PADDING) => {
    const rect = element.getBoundingClientRect();
    return (
      coords.x >= rect.left - padding &&
      coords.x <= rect.right + padding &&
      coords.y >= rect.top - padding &&
      coords.y <= rect.bottom + padding
    );
  };

  const setConfirmed = (id) => {
    confirmedTargetRef.current = id;
    setConfirmedTarget(id);
  };

  useEffect(() => {
    if (!isCalibrated) return;

    let candidateId = null;

    if (!isMenuOpen) {
      const el = document.getElementById('center-btn');
      if (el && isLookingAt(el, gaze)) candidateId = 'center';
    } else {
      for (const item of MENU_ITEMS) {
        const el = document.getElementById(item.id);
        if (el && isLookingAt(el, gaze)) { candidateId = item.id; break; }
      }
    }

    const now = Date.now();

    if (!candidateId) {
      setHoveredButton(null);
      // ★ 시선이 벗어났을 때 바로 확정 해제 X → CLEAR_MS 후에 해제
      if (!clearTimerRef.current && confirmedTargetRef.current) {
        clearTimerRef.current = setTimeout(() => {
          setConfirmed(null);
          fixationRef.current = { targetId: null, startTime: null };
          clearTimerRef.current = null;
        }, CLEAR_MS);
      }
      return;
    }

    // 버튼 위에 있으면 해제 타이머 취소
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    if (fixationRef.current.targetId !== candidateId) {
      fixationRef.current = { targetId: candidateId, startTime: now };
      setHoveredButton(candidateId);
      return;
    }

    setHoveredButton(candidateId);

    const duration = now - fixationRef.current.startTime;
    if (duration >= DWELL_MS && confirmedTargetRef.current !== candidateId) {
      console.log(`[Confirmed] ${candidateId} after ${duration}ms`);
      setConfirmed(candidateId);
    }

  }, [gaze, isMenuOpen, isCalibrated]);

  const speakText = (text) => {
    if (!window.speechSynthesis || !text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleBlink = () => {
    if (!isCalibrated) return;
    const target = confirmedTargetRef.current;
    console.log('[Blink] target:', target, '| isMenuOpen:', isMenuOpenRef.current);

    if (!target) {
      console.warn('[Blink] 확정된 버튼 없음 → 무시');
      return;
    }

    if (target === 'center') {
      setIsMenuOpen(true);
      speakText('메뉴를 엽니다');
    } else if (isMenuOpenRef.current) {
      const selected = MENU_ITEMS.find(i => i.id === target);
      if (selected) {
        setSelectedMessage(selected.action);
        setShowMessage(true);
        speakText(selected.action);
        setTimeout(() => setShowMessage(false), 2500);
        setIsMenuOpen(false);
      }
    }

    setConfirmed(null);
    fixationRef.current = { targetId: null, startTime: null };
    setHoveredButton(null);
  };

  return (
    <div className="App">
      <EyeController
        onGazeChange={setGaze}
        onBlink={handleBlink}
        onEarChange={setCurrentEAR}
      />

      {!isCalibrated ? (
        <Calibration onComplete={() => setIsCalibrated(true)} gaze={gaze} />
      ) : (
        <>
          {/* 디버깅 표시 — 잘 되면 지워도 됨 */}
          <div className="ear-display-box">
            EAR: <strong>{currentEAR.toFixed(3)}</strong>
            {' '}| 응시: <strong>{hoveredButton ?? '—'}</strong>
            {' '}| 확정: <strong style={{ color: confirmedTarget ? 'limegreen' : 'gray' }}>
              {confirmedTarget ?? '대기중'}
            </strong>
          </div>

          {showMessage && (
            <div className="message-alert">
              <div className="message-content">{selectedMessage}</div>
            </div>
          )}

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
                {MENU_ITEMS.map((item) => (
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
