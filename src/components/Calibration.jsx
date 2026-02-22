import React, { useState } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 39점 3단계 Calibration
// 단계 1 (1~13):  전체 프레임 — 중앙→중간→상단→좌우→모서리
// 단계 2 (14~26): 중앙 집중  — 중앙 주변 촘촘하게
// 단계 3 (27~39): 가장자리   — 바깥쪽·모서리 균일화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STAGES = [
  {
    label: '단계 1 / 3 — 전체 프레임',
    desc: '화면 전체의 기본 영역을 잡습니다',
    color: '#4A90D9',
    points: [
      // 중앙
      { id: 'pt1',  top: '50%', left: '50%' },
      // 중간 십자
      { id: 'pt2',  top: '30%', left: '50%' },
      { id: 'pt3',  top: '70%', left: '50%' },
      { id: 'pt4',  top: '50%', left: '25%' },
      { id: 'pt5',  top: '50%', left: '75%' },
      // 상단 라인
      { id: 'pt6',  top: '10%', left: '25%' },
      { id: 'pt7',  top: '10%', left: '50%' },
      { id: 'pt8',  top: '10%', left: '75%' },
      // 좌우 중간
      { id: 'pt9',  top: '30%', left: '10%' },
      { id: 'pt10', top: '70%', left: '10%' },
      { id: 'pt11', top: '30%', left: '90%' },
      { id: 'pt12', top: '70%', left: '90%' },
      // 하단 중앙
      { id: 'pt13', top: '90%', left: '50%' },
    ],
  },
  {
    label: '단계 2 / 3 — 중앙 정밀',
    desc: '중앙 영역을 촘촘하게 보정합니다 (tracking 정확도 향상)',
    color: '#E67E22',
    points: [
      // 중앙 3×3 격자
      { id: 'pt14', top: '35%', left: '35%' },
      { id: 'pt15', top: '35%', left: '50%' },
      { id: 'pt16', top: '35%', left: '65%' },
      { id: 'pt17', top: '50%', left: '35%' },
      { id: 'pt18', top: '50%', left: '50%' },
      { id: 'pt19', top: '50%', left: '65%' },
      { id: 'pt20', top: '65%', left: '35%' },
      { id: 'pt21', top: '65%', left: '50%' },
      { id: 'pt22', top: '65%', left: '65%' },
      // 중앙 주변 보조
      { id: 'pt23', top: '42%', left: '42%' },
      { id: 'pt24', top: '42%', left: '58%' },
      { id: 'pt25', top: '58%', left: '42%' },
      { id: 'pt26', top: '58%', left: '58%' },
    ],
  },
  {
    label: '단계 3 / 3 — 가장자리 균일화',
    desc: '화면 바깥쪽을 훑어 전체 정확도를 균일하게 만듭니다',
    color: '#27AE60',
    points: [
      // 네 모서리
      { id: 'pt27', top:  '5%', left:  '5%' },
      { id: 'pt28', top:  '5%', left: '95%' },
      { id: 'pt29', top: '95%', left:  '5%' },
      { id: 'pt30', top: '95%', left: '95%' },
      // 상·하 가장자리
      { id: 'pt31', top:  '5%', left: '30%' },
      { id: 'pt32', top:  '5%', left: '70%' },
      { id: 'pt33', top: '95%', left: '30%' },
      { id: 'pt34', top: '95%', left: '70%' },
      // 좌·우 가장자리
      { id: 'pt35', top: '20%', left:  '3%' },
      { id: 'pt36', top: '50%', left:  '3%' },
      { id: 'pt37', top: '80%', left:  '3%' },
      { id: 'pt38', top: '20%', left: '97%' },
      { id: 'pt39', top: '80%', left: '97%' },
    ],
  },
];

const REQUIRED_COUNT = 5; // 각 점 5번 클릭

const Calibration = ({ onComplete, gaze = { x: 0, y: 0 } }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [clickCounts, setClickCounts] = useState({});

  const stage = STAGES[stageIndex];
  const points = stage.points;

  const completedInStage = points.filter(p => (clickCounts[p.id] || 0) >= REQUIRED_COUNT).length;
  const progressPercent = Math.round((completedInStage / points.length) * 100);

  // 전체 진행률 (39점 기준)
  const totalDone = STAGES.flatMap(s => s.points).filter(p => (clickCounts[p.id] || 0) >= REQUIRED_COUNT).length;
  const totalPercent = Math.round((totalDone / 39) * 100);

  const handlePointClick = (id) => {
    const currentCount = clickCounts[id] || 0;
    if (currentCount >= REQUIRED_COUNT) return;

    const newCount = currentCount + 1;
    const newCounts = { ...clickCounts, [id]: newCount };
    setClickCounts(newCounts);

    // WebGazer 학습 데이터 기록
    const pointEl = document.getElementById(id);
    if (pointEl && window.webgazer) {
      const rect = pointEl.getBoundingClientRect();
      window.webgazer.recordScreenPosition(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        'calibration'
      );
    }

    // 현재 단계 완료 확인
    const stageDone = points.every(p =>
      (p.id === id ? newCount : (newCounts[p.id] || 0)) >= REQUIRED_COUNT
    );

    if (stageDone) {
      if (stageIndex < STAGES.length - 1) {
        // 다음 단계로
        setTimeout(() => setStageIndex(stageIndex + 1), 400);
      } else {
        // 전체 완료
        setTimeout(() => {
          alert('보정이 완료되었습니다! 메뉴로 이동합니다.');
          onComplete();
        }, 400);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'white', zIndex: 50,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 시선 추적 점 */}
      {gaze && gaze.x > 0 && (
        <div style={{
          position: 'fixed',
          left: `${gaze.x}px`, top: `${gaze.y}px`,
          width: '14px', height: '14px',
          backgroundColor: '#FF3366', borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999, pointerEvents: 'none',
          boxShadow: '0 0 8px rgba(255,51,102,0.7)',
        }} />
      )}

      {/* 헤더 */}
      <h2 style={{ marginBottom: '6px', color: '#333', fontSize: '22px' }}>
        시선 보정 (Calibration)
      </h2>

      {/* 단계 배지 */}
      <div style={{
        background: stage.color, color: 'white',
        borderRadius: '20px', padding: '4px 16px',
        fontWeight: 'bold', fontSize: '14px', marginBottom: '6px',
      }}>
        {stage.label}
      </div>
      <p style={{ color: '#666', marginBottom: '4px', fontSize: '14px' }}>{stage.desc}</p>
      <p style={{ color: '#888', marginBottom: '12px', fontSize: '13px' }}>
        각 점을 <b>쳐다보면서 {REQUIRED_COUNT}번씩</b> 클릭하세요
      </p>

      {/* 단계 내 진행바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>이번 단계</span>
        <div style={{ width: '200px', height: '12px', background: '#eee', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: stage.color, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', color: '#666' }}>{completedInStage}/{points.length}</span>
      </div>

      {/* 전체 진행바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <span style={{ fontSize: '13px', color: '#999' }}>전체</span>
        <div style={{ width: '200px', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${totalPercent}%`, height: '100%', background: '#aaa', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', color: '#999' }}>{totalDone}/39 ({totalPercent}%)</span>
      </div>

      {/* 단계 인디케이터 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {STAGES.map((s, i) => (
          <div key={i} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: i < stageIndex ? '#ccc' : i === stageIndex ? s.color : '#eee',
            color: i <= stageIndex ? 'white' : '#aaa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '14px',
            border: i === stageIndex ? `3px solid ${s.color}` : '3px solid transparent',
            transition: 'all 0.3s',
          }}>
            {i < stageIndex ? '✓' : i + 1}
          </div>
        ))}
      </div>

      {/* 현재 단계 점들만 표시 */}
      {points.map(p => {
        const count = clickCounts[p.id] || 0;
        const isDone = count >= REQUIRED_COUNT;
        const opacity = Math.min(0.25 + count * 0.15, 1);

        return (
          <button
            key={p.id}
            id={p.id}
            onClick={() => handlePointClick(p.id)}
            disabled={isDone}
            style={{
              position: 'absolute',
              top: p.top, left: p.left,
              width: '42px', height: '42px',
              borderRadius: '50%',
              border: isDone ? `3px solid ${stage.color}` : '2px solid rgba(0,0,0,0.15)',
              backgroundColor: isDone ? stage.color : stage.color,
              opacity: isDone ? 1 : opacity,
              transform: 'translate(-50%, -50%)',
              cursor: isDone ? 'default' : 'pointer',
              boxShadow: isDone
                ? `0 0 14px ${stage.color}99`
                : '0 0 8px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              color: 'white', fontSize: '12px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isDone ? '✓' : count}
          </button>
        );
      })}
    </div>
  );
};

export default Calibration;
