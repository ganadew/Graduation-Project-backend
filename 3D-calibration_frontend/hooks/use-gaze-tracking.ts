"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// 동일 호스트에서 연결 (localhost:3001 → localhost:8765, 172.x:3001 → 172.x:8765)
const getWsUrl = () =>
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:8765`
    : "ws://localhost:8765"
const RECONNECT_DELAY_MS = 3000

export interface GazePosition {
  x: number
  y: number
}

export function useGazeTracking() {
  const [gaze, setGaze] = useState<GazePosition | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [webcamFrame, setWebcamFrame] = useState<string | null>(null) // base64 JPEG
  const [calibrationPoint, setCalibrationPoint] = useState<{
    index: number
    normX: number
    normY: number
  } | null>(null)
  const [calibrationComplete, setCalibrationComplete] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] 연결 성공');
      setIsConnected(true);
      setConnectionError(null);
    };

    ws.onclose = (e) => {
      console.log('[WS] 연결 종료', e);
      setIsConnected(false);
      setGaze(null);
      setWebcamFrame(null);
      setCalibrationPoint(null);
      wsRef.current = null;
      setConnectionError("연결 끊김 (재연결 시도 중)");
      reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = (e) => {
      console.error('[WS] 에러', e);
      setConnectionError("WebSocket 오류");
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] 수신:', msg);
        if (msg.type === "gaze" && typeof msg.x === "number" && typeof msg.y === "number") {
          console.log('[Gaze] gaze 값:', msg);
          setGaze({ x: msg.x, y: msg.y });
        } else if (msg.type === "frame" && typeof msg.data === "string") {
          setWebcamFrame(msg.data);
        } else if (msg.type === "calibration_show_point" && typeof msg.index === "number") {
          setCalibrationPoint({
            index: msg.index,
            normX: Number(msg.normX) ?? 0.5,
            normY: Number(msg.normY) ?? 0.5,
          });
        } else if (msg.type === "calibration_complete") {
          setCalibrationPoint(null);
          setCalibrationComplete(true);
        }
      } catch (err) {
        console.error('[WS] 메시지 파싱 오류', err);
      }
    };
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const sendCalibrationStart = useCallback((screenWidth: number, screenHeight: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "calibration_start",
          screenWidth,
          screenHeight,
        })
      )
    }
  }, [])

  const sendCalibrationSamples = useCallback(
    (
      samples: { targetX: number; targetY: number; gazeX: number; gazeY: number }[],
      source: string
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && samples.length > 0) {
        wsRef.current.send(
          JSON.stringify({
            type: "follow_target_samples",
            samples,
            source,
          })
        )
      }
    },
    []
  )

  return {
    gaze,
    isConnected,
    connectionError,
    webcamFrame,
    calibrationPoint,
    calibrationComplete,
    sendCalibrationStart,
    sendCalibrationSamples,
    startCalibration: useCallback(() => {
      setCalibrationComplete(false)
      if (typeof window !== "undefined") {
        sendCalibrationStart(window.innerWidth, window.innerHeight)
      }
    }, [sendCalibrationStart]),
  }
}
