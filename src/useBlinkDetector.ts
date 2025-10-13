import { useEffect } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

type Opts = {
  video: HTMLVideoElement | null;        // 처리할 <video>
  onBlink: () => void;                   // 깜빡임 발생 시 콜백
  closeThresh?: number;                  // EAR 감음 임계값
  openThresh?: number;                   // EAR 개안 임계값
  minCloseMs?: number;                   // 최소 감은 시간(ms)
  fps?: number;                          // 처리 프레임 (기본 15)
  onMetrics?: (ear: number, closed: boolean) => void; // 디버그
};

export function useBlinkDetector({
  video,
  onBlink,
  closeThresh = 0.20,
  openThresh = 0.25,
  minCloseMs = 120,
  fps = 15,
  onMetrics,
}: Opts) {
  useEffect(() => {
    if (!video) return;

    let stopped = false;
    let rafId: number | null = null;
    let stream: MediaStream | null = null;

    const setup = async () => {
      // 1) 카메라 스트림 직접 열기 (안정화)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
        video.srcObject = stream;
        // iOS 등 자동재생 대비
        await video.play().catch(() => {});
        console.log("[blink] camera started (getUserMedia)");
      } catch (e) {
        console.error("[blink] getUserMedia failed:", e);
        return;
      }

      // 2) FaceMesh 초기화
      const faceMesh = new FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      let isBlinking = false;
      let closedAt = 0;

      const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
      const earOf = (lm: any[], idx: number[]) => {
        const v1 = dist(lm[idx[1]], lm[idx[5]]);
        const v2 = dist(lm[idx[2]], lm[idx[4]]);
        const h  = dist(lm[idx[0]], lm[idx[3]]);
        return (v1 + v2) / (2 * h);
      };

      faceMesh.onResults((res: any) => {
        const lm = res.multiFaceLandmarks?.[0];
        if (!lm) return;

        const LEFT  = [33,160,158,133,153,144];
        const RIGHT = [263,387,385,362,380,373];

        const earL = earOf(lm, LEFT);
        const earR = earOf(lm, RIGHT);
        const ear  = (earL + earR) / 2;

        onMetrics?.(ear, isBlinking || ear < closeThresh);

        if (ear < closeThresh && !isBlinking) {
          isBlinking = true;
          closedAt = performance.now();
        } else if (ear >= openThresh && isBlinking) {
          const dur = performance.now() - closedAt;
          if (dur >= minCloseMs) onBlink();
          isBlinking = false;
        }
      });

      // 3) rAF 루프 (fps 제한)
      let last = 0;
      const loop = async (ts: number) => {
        if (stopped) return;
        if (ts - last >= 1000 / fps) {
          last = ts;
          if (video.readyState >= 2) {
            await faceMesh.send({ image: video });
          }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    };

    setup();

    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [video, onBlink, closeThresh, openThresh, minCloseMs, fps, onMetrics]);
}
