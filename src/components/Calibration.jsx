import React, { useState } from 'react';

const Calibration = ({ onComplete }) => {
  const [clickCounts, setClickCounts] = useState({}); // 각 점을 몇 번 클릭했는지 저장

  // 9개의 보정 포인트 위치 (화면 백분율)
  const points = [
    { id: 'pt1', top: '10%', left: '10%' }, { id: 'pt2', top: '10%', left: '50%' }, { id: 'pt3', top: '10%', left: '90%' },
    { id: 'pt4', top: '50%', left: '10%' }, { id: 'pt5', top: '50%', left: '50%' }, { id: 'pt6', top: '50%', left: '90%' },
    { id: 'pt7', top: '90%', left: '10%' }, { id: 'pt8', top: '90%', left: '50%' }, { id: 'pt9', top: '90%', left: '90%' },
  ];

  const handlePointClick = (id) => {
    const currentCount = clickCounts[id] || 0;
    const newCount = currentCount + 1;
    
    setClickCounts({ ...clickCounts, [id]: newCount });

    // 각 점을 5번씩 클릭하면 해당 점은 완료 처리 (색상 변경 등)
    // 전체 점이 다 5번 이상 클릭되었는지 확인
    const allDone = points.every(p => {
      const count = (id === p.id ? newCount : (clickCounts[p.id] || 0));
      return count >= 5;
    });

    if (allDone) {
      alert("보정이 완료되었습니다! 메뉴로 이동합니다.");
      onComplete(); // App.jsx에 완료 신호 보냄
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'white', zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>시선 보정 (Calibration)</h2>
      <p>각 빨간 점을 쳐다보면서 <b>5번씩 클릭</b>해주세요.</p>
      <p>빨간 점이 <b>초록색</b>으로 변하면 다음 점으로 넘어가세요.</p>
      
      {/* 9개의 점 배치 */}
      {points.map(p => {
        const count = clickCounts[p.id] || 0;
        const isDone = count >= 5;
        // 투명도: 클릭할수록 진해짐
        const opacity = Math.min(0.2 + (count * 0.2), 1); 

        return (
          <button
            key={p.id}
            onClick={() => handlePointClick(p.id)}
            disabled={isDone} // 완료되면 클릭 방지
            style={{
              position: 'absolute',
              top: p.top,
              left: p.left,
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isDone ? '#4CAF50' : 'red', // 완료되면 초록색
              opacity: isDone ? 1 : opacity,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0,0,0,0.2)',
              transition: 'all 0.2s'
            }}
          >
            {isDone ? 'OK' : count}
          </button>
        );
      })}
    </div>
  );
};

export default Calibration;