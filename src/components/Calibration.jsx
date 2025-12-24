import React, { useState } from 'react';

const Calibration = ({ onComplete }) => {
  const [clickCounts, setClickCounts] = useState({}); // 각 점을 몇 번 클릭했는지 저장

  // 보정 포인트 위치 (화면 백분율) – 6 x 6 = 36개
  const points = [
    // 행 1 (상단)
    { id: 'pt1', top: '8%', left: '5%' },   { id: 'pt2', top: '8%', left: '25%' },  { id: 'pt3', top: '8%', left: '45%' },  { id: 'pt4', top: '8%', left: '65%' },  { id: 'pt5', top: '8%', left: '85%' },  { id: 'pt6', top: '8%', left: '95%' },
    // 행 2
    { id: 'pt7', top: '26%', left: '5%' },  { id: 'pt8', top: '26%', left: '25%' }, { id: 'pt9', top: '26%', left: '45%' }, { id: 'pt10', top: '26%', left: '65%' }, { id: 'pt11', top: '26%', left: '85%' }, { id: 'pt12', top: '26%', left: '95%' },
    // 행 3 (중간 위)
    { id: 'pt13', top: '44%', left: '5%' }, { id: 'pt14', top: '44%', left: '25%' }, { id: 'pt15', top: '44%', left: '45%' }, { id: 'pt16', top: '44%', left: '65%' }, { id: 'pt17', top: '44%', left: '85%' }, { id: 'pt18', top: '44%', left: '95%' },
    // 행 4 (중간 아래)
    { id: 'pt19', top: '62%', left: '5%' }, { id: 'pt20', top: '62%', left: '25%' }, { id: 'pt21', top: '62%', left: '45%' }, { id: 'pt22', top: '62%', left: '65%' }, { id: 'pt23', top: '62%', left: '85%' }, { id: 'pt24', top: '62%', left: '95%' },
    // 행 5
    { id: 'pt25', top: '80%', left: '5%' }, { id: 'pt26', top: '80%', left: '25%' }, { id: 'pt27', top: '80%', left: '45%' }, { id: 'pt28', top: '80%', left: '65%' }, { id: 'pt29', top: '80%', left: '85%' }, { id: 'pt30', top: '80%', left: '95%' },
    // 행 6 (하단)
    { id: 'pt31', top: '96%', left: '5%' }, { id: 'pt32', top: '96%', left: '25%' }, { id: 'pt33', top: '96%', left: '45%' }, { id: 'pt34', top: '96%', left: '65%' }, { id: 'pt35', top: '96%', left: '85%' }, { id: 'pt36', top: '96%', left: '95%' },
  ];

  const REQUIRED_COUNT = 10; // 각 점을 눌러야 하는 횟수

  const handlePointClick = (id) => {
    const currentCount = clickCounts[id] || 0;
    const newCount = currentCount + 1;
    
    setClickCounts({ ...clickCounts, [id]: newCount });

    // 각 점을 지정 횟수(REQUIRED_COUNT)만큼 클릭하면 해당 점은 완료 처리
    // 전체 점이 다 REQUIRED_COUNT 이상 클릭되었는지 확인
    const allDone = points.every(p => {
      const count = (id === p.id ? newCount : (clickCounts[p.id] || 0));
      return count >= REQUIRED_COUNT;
    });

    if (allDone) {
      alert("보정이 완료되었습니다! 메뉴로 이동합니다.");
      onComplete(); // App.jsx에 완료 신호 보냄
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'white', 
      // 카메라(video)는 App.css에서 z-index: 100 이므로,
      // 보정 화면을 그보다 아래에 두어 보정 중에도 카메라가 보이게 한다.
      zIndex: 50, 
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>시선 보정 (Calibration)</h2>
      <p>화면에 보이는 <b>모든 빨간 점</b>을 쳐다보면서 <b>각각 10번씩 클릭</b>해주세요.</p>
      <p>빨간 점이 <b>초록색</b>으로 변하면 해당 점의 보정이 완료된 것입니다.</p>
      
      {/* 9개의 점 배치 */}
      {points.map(p => {
        const count = clickCounts[p.id] || 0;
        const isDone = count >= REQUIRED_COUNT;
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