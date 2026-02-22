import React, { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

/**
 * EyeController
 * - WebGazer로 시선(gaze) 추적
 * - MediaPipe FaceMesh로 EAR 계산 & Long Blink 감지
 * - FaceMesh 인스턴스는 이 컴포넌트 하나에서만 관리 (MediaPipeFaceDetector.jsx는 삭제하거나 사용하지 마세요)
 */
const EyeController = ({ onGazeChange, onBlink, onEarChange }) => {
  const BLINK_EAR_THRESHOLD = 0.20;
  const BLINK_DURATION_THRESHOLD = 350; // ms

  const blinkStartTime = useRef(null);
  const hasTriggered = useRef(false);
  const animFrameRef = useRef(null);
  const faceMeshRef = useRef(null);

  // Stale Closure 방지
  const latestOnBlink = useRef(onBlink);
  const latestOnGazeChange = useRef(onGazeChange);
  const latestOnEarChange = useRef(onEarChange);
  useEffect(() => { latestOnBlink.current = onBlink; }, [onBlink]);
  useEffect(() => { latestOnGazeChange.current = onGazeChange; }, [onGazeChange]);
  useEffect(() => { latestOnEarChange.current = onEarChange; }, [onEarChange]);

  const calculateEAR = (landmarks, idx) => {
    const d = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    const v1 = d(landmarks[idx[1]], landmarks[idx[5]]);
    const v2 = d(landmarks[idx[2]], landmarks[idx[4]]);
    const h  = d(landmarks[idx[0]], landmarks[idx[3]]);
    return h === 0 ? 0 : (v1 + v2) / (2.0 * h);
  };

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      // ── 1. FaceMesh 초기화 ──────────────────────────────────────────
      const faceMesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMeshRef.current = faceMesh;

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks?.length) {
          latestOnEarChange.current?.(0);
          return;
        }

        const lm = results.multiFaceLandmarks[0];
        // 검증된 랜드마크 인덱스
        const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
        const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

        const leftEAR  = calculateEAR(lm, LEFT_EYE);
        const rightEAR = calculateEAR(lm, RIGHT_EYE);
        const avgEAR   = (leftEAR + rightEAR) / 2;

        latestOnEarChange.current?.(avgEAR);

        // ── Long Blink 감지 ──
        if (avgEAR < BLINK_EAR_THRESHOLD) {
          if (blinkStartTime.current === null) {
            blinkStartTime.current = Date.now();
            hasTriggered.current = false;
          } else if (!hasTriggered.current) {
            const duration = Date.now() - blinkStartTime.current;
            if (duration >= BLINK_DURATION_THRESHOLD) {
              console.log(`[Long Blink] duration=${duration}ms EAR=${avgEAR.toFixed(3)}`);
              latestOnBlink.current?.();
              hasTriggered.current = true;
            }
          }
        } else {
          blinkStartTime.current = null;
          hasTriggered.current   = false;
        }
      });

      // ── 2. WebGazer 초기화 ──────────────────────────────────────────
      if (!window.webgazer) {
        console.error('[EyeController] WebGazer not loaded');
        return;
      }

      window.webgazer.showPredictionPoints(false);
      window.webgazer.setGazeListener((data) => {
        if (data) {
          console.log('gaze:', Math.round(data.x), Math.round(data.y)); // 임시 확인용
          latestOnGazeChange.current?.({ x: data.x, y: data.y });
  }
      });

      try {
        await window.webgazer.begin();
      } catch (err) {
        // begin()이 callback 기반이라 reject 없이 throw하기도 함 — 무시
        console.warn('[EyeController] webgazer.begin warning:', err);
      }

      // ── 3. WebGazer 비디오 요소 대기 후 FaceMesh에 프레임 전송 ───────
      const videoEl = await waitForVideo(30, 150); // 최대 4.5초 대기
      if (!videoEl || cancelled) return;

      console.log('[EyeController] Video ready, starting FaceMesh loop');

      const sendLoop = async () => {
        if (cancelled) return;
        // ★ readyState 4 = HAVE_ENOUGH_DATA (기존 코드의 2는 잘못된 값)
        if (
          videoEl.readyState >= 2 &&   // HAVE_CURRENT_DATA 이상이면 전송
          !videoEl.paused &&
          !videoEl.ended
        ) {
          try {
            await faceMesh.send({ image: videoEl });
          } catch (e) {
            console.warn('[EyeController] faceMesh.send error:', e);
          }
        }
        animFrameRef.current = requestAnimationFrame(sendLoop);
      };
      animFrameRef.current = requestAnimationFrame(sendLoop);
    };

    setup();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      faceMeshRef.current?.close?.();
      window.webgazer?.end?.();
    };
  }, []);

  return null;
};

// ── 유틸: #webgazerVideoFeed 요소가 나타날 때까지 폴링 ──────────────────────
function waitForVideo(maxTries = 30, intervalMs = 150) {
  return new Promise((resolve) => {
    let tries = 0;
    const check = setInterval(() => {
      const el = document.querySelector('#webgazerVideoFeed');
      tries++;
      if (el) {
        clearInterval(check);
        // 스트림이 충분히 로드될 때까지 추가 대기
        if (el.readyState >= 2) {
          resolve(el);
        } else {
          el.addEventListener('canplay', () => resolve(el), { once: true });
        }
      } else if (tries >= maxTries) {
        clearInterval(check);
        console.warn('[EyeController] webgazerVideoFeed not found');
        resolve(null);
      }
    }, intervalMs);
  });
}

export default EyeController;
