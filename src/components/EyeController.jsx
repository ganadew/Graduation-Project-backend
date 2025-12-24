import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

const EyeController = ({ onGazeChange, onBlink, onEarChange }) => {
  // ★ "Long Blink"를 위한 타이머 변수들
  const blinkStartTime = useRef(null); // 눈을 감기 시작한 시간
  const hasTriggered = useRef(false);  // 이미 클릭이 발동했는지 체크
  // 깜빡임 감도: EAR이 임계값 미만으로 유지되는 최소 시간(ms)
  const BLINK_EAR_THRESHOLD = 0.32;
  const BLINK_DP_THRESHOLD = 350;      // 0.35초 이상 감으면 클릭 처리 (짧게 조정)

  // 부모 함수 최신화 (Stale Closure 방지)
  const latestOnBlink = useRef(onBlink);
  const latestOnGazeChange = useRef(onGazeChange);
  const latestOnEarChange = useRef(onEarChange);

  useEffect(() => { latestOnBlink.current = onBlink; }, [onBlink]);
  useEffect(() => { latestOnGazeChange.current = onGazeChange; }, [onGazeChange]);
  useEffect(() => { latestOnEarChange.current = onEarChange; }, [onEarChange]);

  const calculateEAR = (landmarks, eyeIndices) => {
    const distance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const v1 = distance(landmarks[eyeIndices[1]], landmarks[eyeIndices[5]]);
    const v2 = distance(landmarks[eyeIndices[2]], landmarks[eyeIndices[4]]);
    const h = distance(landmarks[eyeIndices[0]], landmarks[eyeIndices[3]]);
    return (v1 + v2) / (2.0 * h);
  };

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
      const landmarks = results.multiFaceLandmarks[0];
      
      const LEFT_EYE = [33, 160, 158, 133, 153, 144];
      const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
      
      const leftEAR = calculateEAR(landmarks, LEFT_EYE);
      const rightEAR = calculateEAR(landmarks, RIGHT_EYE);
      const avgEAR = (leftEAR + rightEAR) / 2;

      // EAR 값 화면 표시용 전달
      if (latestOnEarChange.current) latestOnEarChange.current(avgEAR);

      // ★★★ 핵심 로직 수정: 롱 블링크 (Long Blink) 감지 ★★★
      
      // 1. 눈을 감았다고 판단되면 (임계값 미만)
      if (avgEAR < BLINK_EAR_THRESHOLD) {
        // 타이머 시작 (처음 감았을 때만 기록)
        if (blinkStartTime.current === null) {
          blinkStartTime.current = Date.now();
        } 
        // 이미 감고 있는 중이라면 시간 체크
        else {
          const duration = Date.now() - blinkStartTime.current;
          
          // 0.8초 이상 지났고 + 아직 클릭 안 했으면 -> 실행!
          if (duration > BLINK_DP_THRESHOLD && !hasTriggered.current) {
            console.log("Long Blink Detected! Action Triggered.");
            if (latestOnBlink.current) latestOnBlink.current();
            
            hasTriggered.current = true; // 눈 뜰 때까지 중복 실행 방지
          }
        }
      } 
      // 2. 눈을 떴으면 (0.3 이상)
      else {
        // 모든 변수 초기화 (다음 깜빡임 대기)
        blinkStartTime.current = null;
        hasTriggered.current = false;
      }
    });

    const setupWebGazer = async () => {
      if (window.webgazer) {
        window.webgazer.showPredictionPoints(false); // 빨간 점 2개 뜨는 것 방지

        await window.webgazer.setGazeListener((data, clock) => {
          if (data && latestOnGazeChange.current) {
            latestOnGazeChange.current({ x: data.x, y: data.y });
          }
        }).begin();

        const checkVideo = setInterval(() => {
          const videoEl = document.querySelector('#webgazerVideoFeed');
          if (videoEl) {
            clearInterval(checkVideo);
            const sendToMediaPipe = async () => {
              if (!videoEl.paused && !videoEl.ended) {
                await faceMesh.send({ image: videoEl });
              }
              requestAnimationFrame(sendToMediaPipe);
            };
            sendToMediaPipe();
          }
        }, 500);
      }
    };

    setupWebGazer();

    return () => {
      if (window.webgazer) window.webgazer.end();
    };
  }, []); 

  return null;
};

export default EyeController;