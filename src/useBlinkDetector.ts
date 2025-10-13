import { useEffect, useRef } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

type Opts = {
  video: HTMLVideoElement | null;
  onBlink: () => void;
  closeThresh?: number;
  openThresh?: number;
  minCloseMs?: number;
  fps?: number;
  onMetrics?: (ear: number, closed: boolean) => void;
};

export function useBlinkDetector({
  video,
  onBlink,
  closeThresh = 0.22,
  openThresh = 0.30,
  minCloseMs = 120,
  fps = 15,
  onMetrics,
}: Opts) {
  // 최신 콜백/옵션을 ref로 유지
  const onBlinkRef = useRef(onBlink);
  const onMetricsRef = useRef(onMetrics);
  const closeRef = useRef(closeThresh);
  const openRef = useRef(openThresh);
  const minCloseRef = useRef(minCloseMs);
  const fpsRef = useRef(fps);

  useEffect(() => { onBlinkRef.current = onBlink; }, [onBlink]);
  useEffect(() => { onMetricsRef.current = onMetrics; }, [onMetrics]);
  useEffect(() => { closeRef.current = closeThresh; }, [closeThresh]);
  useEffect(() => { openRef.current = openThresh; }, [openThresh]);
  useEffect(() => { minCloseRef.current = minCloseMs; }, [minCloseMs]);
  useEffect(() => { fpsRef.current = fps; }, [fps]);

  useEffect(() => {
    if (!video) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let mesh: FaceMesh | null = null;
    let isClosed = false;
    let closedAt = 0;
    let rafId: number | null = null;
    let rVFCId: number | null = null;
    let lastTs = 0;

    // 비디오 안전 플래그
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    (video as HTMLVideoElement).muted = true;

    const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
    const earOf = (lm: any[], idx: number[]) => {
      const v1 = dist(lm[idx[1]], lm[idx[5]]);
      const v2 = dist(lm[idx[2]], lm[idx[4]]);
      const h  = dist(lm[idx[0]], lm[idx[3]]);
      return (v1 + v2) / (2 * h);
    };

    const onResults = (res: any) => {
      if (stopped) return;
      const lm = res.multiFaceLandmarks?.[0];
      if (!lm) return;

      const LEFT  = [33,160,158,133,153,144];
      const RIGHT = [263,387,385,362,380,373];

      const earL = earOf(lm, LEFT);
      const earR = earOf(lm, RIGHT);
      const ear  = (earL + earR) / 2;

      const closeT = closeRef.current;
      const openT  = openRef.current;

      onMetricsRef.current?.(ear, isClosed || ear < closeT);

      if (!isClosed && ear < closeT) {
        isClosed = true;
        closedAt = performance.now();
      } else if (isClosed && ear >= openT) {
        const dur = performance.now() - closedAt;
        if (dur >= minCloseRef.current) onBlinkRef.current?.();
        isClosed = false;
      }
    };

    const stepRAF = async (ts: number) => {
      if (stopped) return;
      const budget = 1000 / (fpsRef.current || 15);
      if (!lastTs || ts - lastTs >= budget) {
        lastTs = ts;
        if (video.readyState >= 2 && mesh) await mesh.send({ image: video });
      }
      rafId = requestAnimationFrame(stepRAF);
    };

    const stepRVFC = async (_now: number, _meta: any) => {
      if (stopped) return;
      const now = performance.now();
      const budget = 1000 / (fpsRef.current || 15);
      if (!lastTs || now - lastTs >= budget) {
        lastTs = now;
        if (video.readyState >= 2 && mesh) await mesh.send({ image: video });
      }
      rVFCId = (video as any).requestVideoFrameCallback(stepRVFC);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
        mesh = new FaceMesh({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        mesh.onResults(onResults);

        if ("requestVideoFrameCallback" in video) {
          rVFCId = (video as any).requestVideoFrameCallback(stepRVFC);
        } else {
          rafId = requestAnimationFrame(stepRAF);
        }
      } catch (e) {
        console.error("[blink] setup failed:", e);
      }
    };

    const onVis = () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId), (rafId = null);
        if (rVFCId && "cancelVideoFrameCallback" in (video as any)) {
          (video as any).cancelVideoFrameCallback(rVFCId); rVFCId = null;
        }
      } else {
        lastTs = 0;
        if ("requestVideoFrameCallback" in video) {
          rVFCId = (video as any).requestVideoFrameCallback(stepRVFC);
        } else {
          rafId = requestAnimationFrame(stepRAF);
        }
      }
    };

    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      if (rafId) cancelAnimationFrame(rafId);
      if (rVFCId && "cancelVideoFrameCallback" in (video as any)) {
        (video as any).cancelVideoFrameCallback(rVFCId);
      }
      if (stream) stream.getTracks().forEach(t => t.stop());
      mesh = null;
    };
  }, [video]);
}
