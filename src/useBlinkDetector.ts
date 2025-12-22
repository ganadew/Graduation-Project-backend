import { useEffect, useRef } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

type BlinkOpts = {
  onBlink: () => void;
  closeThresh?: number;
  openThresh?: number;
  minCloseMs?: number;
  fps?: number;
  onEarChange?: (ear: number) => void;
};

export function useBlinkDetector({
  onBlink,
  closeThresh = 0.20,
  openThresh = 0.25,
  minCloseMs = 100,
  fps = 15,
  onEarChange,
}: BlinkOpts) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let isBlinking = false;
    let closedAt = 0;
    let stream: MediaStream | null = null;

    const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

    // idx: [outerL, upper1, upper2, outerR, lower2, lower1]
    const earOf = (lm: any[], idx: number[]) => {
      const v1 = dist(lm[idx[1]], lm[idx[5]]);
      const v2 = dist(lm[idx[2]], lm[idx[4]]);
      const h = dist(lm[idx[0]], lm[idx[3]]);
      return (v1 + v2) / (2 * h);
    };

    const run = async () => {
      try {
        const video = document.getElementById("blinkVideo") as
          | HTMLVideoElement
          | null;

        if (!video) {
          console.error("[Blink] blinkVideo 요소를 찾을 수 없음");
          return;
        }

        // 1) 카메라 스트림 요청 (해상도 조금 높게)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();

        // 2) FaceMesh 준비
        const faceMesh = new FaceMesh({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        faceMesh.onResults((res: any) => {
          if (!res.multiFaceLandmarks?.length) {
            if (onEarChange) onEarChange(NaN); // 얼굴 안 잡힐 때 표시용
            return;
          }

          const lm = res.multiFaceLandmarks[0];

          // Mediapipe FaceMesh 기준 눈 주변 index
          const LEFT = [33, 160, 158, 133, 153, 144];
          const RIGHT = [263, 387, 385, 362, 380, 373];

          const earL = earOf(lm, LEFT);
          const earR = earOf(lm, RIGHT);
          const ear = (earL + earR) / 2;

          // 디버그용 로그 (가끔)
          if (Math.random() < 0.05) {
            console.log(
              "[Blink] EAR:",
              ear.toFixed(5),
              "L:",
              earL.toFixed(5),
              "R:",
              earR.toFixed(5)
            );
          }

          if (onEarChange) {
            onEarChange(ear);
          }

          if (ear < closeThresh && !isBlinking) {
            isBlinking = true;
            closedAt = performance.now();
          } else if (ear >= openThresh && isBlinking) {
            const dur = performance.now() - closedAt;
            if (dur >= minCloseMs) {
              console.log("[Blink] BLINK DETECTED, dur =", dur.toFixed(1));
              onBlink();
            }
            isBlinking = false;
          }
        });

        // 3) rAF 루프
        let last = 0;
        const frame = async (ts: number) => {
          if (cancelled) return;

          if (ts - last > 1000 / fps) {
            last = ts;
            if (video.readyState >= 2) {
              try {
                await faceMesh.send({ image: video });
              } catch (err) {
                console.error("[Blink] faceMesh.send 에러:", err);
              }
            }
          }

          rafRef.current = requestAnimationFrame(frame);
        };

        rafRef.current = requestAnimationFrame(frame);
      } catch (err) {
        console.error("[Blink] run() 에러:", err);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onBlink, closeThresh, openThresh, minCloseMs, fps, onEarChange]);
}
