'use client';

import Spline from '@splinetool/react-spline';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Application } from '@splinetool/runtime';

type GazeSocketMessage = {
  type?: string;
  x?: number;
  y?: number;
};

export default function Home() {
  const splineRef = useRef<Application | null>(null);
  const targetZoneRef = useRef<HTMLDivElement | null>(null);
  const wsInitializedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [debugGaze, setDebugGaze] = useState({
    x: 100,
    y: 100,
    visible: false,
    normalizedX: 0,
    normalizedY: 0,
  });

  const gazeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const isRunningRef = useRef(false);
  const hasLaunchedRef = useRef(false);
  const isLookingRef = useRef(false);

  const BALL_ZONE = {
    bottom: '14%',
    left: '50%',
    size: 160,
  };

  const resetProgress = useCallback(() => {
    if (gazeTimerRef.current) {
      clearInterval(gazeTimerRef.current);
      gazeTimerRef.current = null;
    }
    isRunningRef.current = false;
    progressRef.current = 0;
    setProgress(0);
    setIsHovering(false);
  }, []);

  const launchBall = useCallback(() => {
    const spline = splineRef.current;
    if (!spline) {
      console.log('Spline not loaded');
      return;
    }

    const ball = spline.findObjectByName('ball');
    if (!ball) {
      console.log('Ball object not found');
      return;
    }

    try {
      ball.emitEvent('mouseDown');
      console.log('🎳 Ball launched!');
    } catch (error) {
      console.log('ball.emitEvent("mouseDown") failed:', error);
    }
  }, []);

  const startGaze = useCallback(() => {
    if (isRunningRef.current || hasLaunchedRef.current) return;

    if (gazeTimerRef.current) {
      clearInterval(gazeTimerRef.current);
      gazeTimerRef.current = null;
    }

    progressRef.current = 0;
    setProgress(0);
    setIsHovering(true);
    isRunningRef.current = true;

    gazeTimerRef.current = setInterval(() => {
      progressRef.current += 100 / (2000 / 50);
      const clamped = Math.min(progressRef.current, 100);
      setProgress(clamped);

      if (progressRef.current >= 100) {
        if (gazeTimerRef.current) {
          clearInterval(gazeTimerRef.current);
          gazeTimerRef.current = null;
        }

        isRunningRef.current = false;
        setIsHovering(false);
        setProgress(0);
        progressRef.current = 0;

        if (!hasLaunchedRef.current) {
          hasLaunchedRef.current = true;
          launchBall();

          setTimeout(() => {
            hasLaunchedRef.current = false;
          }, 3000);
        }
      }
    }, 50);
  }, [launchBall]);

  const stopGaze = useCallback(() => {
    resetProgress();
  }, [resetProgress]);

  function onLoad(spline: Application) {
    splineRef.current = spline;
    console.log('Spline loaded');

    const ball = spline.findObjectByName('ball');
    console.log('ball object:', ball);
  }

  function onSplineMouseDown(e: { target: { name: string } }) {
    console.log('Spline event:', e.target?.name);
  }

  useEffect(() => {
    if (wsInitializedRef.current) return;
    wsInitializedRef.current = true;

    console.log('creating websocket...');

    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: GazeSocketMessage = JSON.parse(event.data);
        if (data.type !== 'gaze') return;
        if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
        if (!targetZoneRef.current) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const gazeX = data.x * width;
        const gazeY = data.y * height;

        setDebugGaze({
          x: gazeX,
          y: gazeY,
          visible: true,
          normalizedX: data.x,
          normalizedY: data.y,
        });

        const rect = targetZoneRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2;

        const distance = Math.sqrt(
          (gazeX - centerX) ** 2 + (gazeY - centerY) ** 2
        );

        const isLookingAtBall = distance <= radius;

        console.log('📩 gaze:', {
          raw: data,
          px: { x: gazeX, y: gazeY },
          center: { x: centerX, y: centerY },
          radius,
          distance,
          isLookingAtBall,
        });

        if (isLookingAtBall) {
          if (!isLookingRef.current) {
            console.log('👁 looking at ball');
            isLookingRef.current = true;
            startGaze();
          }
        } else {
          if (isLookingRef.current) {
            console.log('👁 left ball area');
            isLookingRef.current = false;
            stopGaze();
          }
        }
      } catch (error) {
        console.log('WebSocket parse failed:', error, event.data);
      }
    };

    ws.onerror = (event) => {
      console.log('ℹ️ WebSocket error event', event);
    };

    ws.onclose = (event) => {
      console.log('ℹ️ WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setWsConnected(false);
    };

    return () => {
      console.log('WebSocket cleanup');
      ws.close();
    };
  }, [startGaze, stopGaze]);

  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Spline
        scene="https://prod.spline.design/93joUJjhd-Bk89IF/scene.splinecode"
        onLoad={onLoad}
        onSplineMouseDown={onSplineMouseDown}
        renderOnDemand={false}
      />

      <div
        ref={targetZoneRef}
        onMouseEnter={() => {
          console.log('🖱 hover enter');
          startGaze();
        }}
        onMouseLeave={() => {
          console.log('🖱 hover leave');
          stopGaze();
        }}
        style={{
          position: 'absolute',
          bottom: BALL_ZONE.bottom,
          left: BALL_ZONE.left,
          transform: 'translateX(-50%)',
          width: `${BALL_ZONE.size}px`,
          height: `${BALL_ZONE.size}px`,
          borderRadius: '50%',
          zIndex: 30,
          pointerEvents: 'auto',
          cursor: 'crosshair',
          outline: '2px dashed rgba(0,255,255,0.6)',
          background: 'rgba(0,255,255,0.05)',
        }}
      />

      {isHovering && (
        <div
          style={{
            position: 'absolute',
            bottom: BALL_ZONE.bottom,
            left: BALL_ZONE.left,
            transform: 'translateX(-50%)',
            width: `${BALL_ZONE.size}px`,
            height: `${BALL_ZONE.size}px`,
            pointerEvents: 'none',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={BALL_ZONE.size}
            height={BALL_ZONE.size}
            viewBox="0 0 160 160"
            style={{ transform: 'rotate(-90deg)', position: 'absolute' }}
          >
            <circle
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="5"
            />
            <circle
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={progress >= 100 ? '#00ffcc' : '#00cfff'}
              strokeWidth="5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.05s linear',
                filter: `drop-shadow(0 0 6px ${
                  progress >= 100 ? '#00ffcc' : '#00cfff'
                })`,
              }}
            />
          </svg>
        </div>
      )}

      {debugGaze.visible && (
        <div
          style={{
            position: 'fixed',
            left: debugGaze.x - 12,
            top: debugGaze.y - 12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'red',
            zIndex: 99999,
            pointerEvents: 'none',
            boxShadow: '0 0 20px red',
            border: '3px solid white',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: 20,
          top: 20,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          lineHeight: 1.5,
          pointerEvents: 'none',
        }}
      >
        <div>ws: {wsConnected ? 'connected' : 'disconnected'}</div>
        <div>
          normalized: {debugGaze.normalizedX.toFixed(3)},{' '}
          {debugGaze.normalizedY.toFixed(3)}
        </div>
        <div>
          pixel: {debugGaze.x.toFixed(1)}, {debugGaze.y.toFixed(1)}
        </div>
        <div>viewport debug active</div>
      </div>

      {!isHovering && (
        <div
          style={{
            position: 'absolute',
            bottom: '4%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.1em',
            pointerEvents: 'none',
            textShadow: '0 1px 6px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
            zIndex: 50,
          }}
        >
          {wsConnected
            ? '👁 공 영역을 바라보거나 마우스를 올리면 던질 수 있습니다'
            : '🔌 시선 인식 서버 연결 중...'}
        </div>
      )}
    </main>
  );
}