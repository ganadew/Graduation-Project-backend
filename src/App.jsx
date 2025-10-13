import { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { drawConnectors } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";

// --------- 공통 보조: 지수이동평균(EMA)로 FPS 스무딩 ----------
function useSmoothedFps() {
  const [fps, setFps] = useState(0);
  const last = useRef(performance.now());
  const ema = useRef(0);
  return [
    fps,
    () => {
      const now = performance.now();
      const inst = 1000 / (now - last.current);
      last.current = now;
      // alpha=0.2 정도로 부드럽게
      ema.current = ema.current ? ema.current * 0.8 + inst * 0.2 : inst;
      setFps(ema.current);
    },
    () => {
      last.current = performance.now();
      ema.current = 0;
      setFps(0);
    },
  ];
}

export default function App() {
  // ---------------- WebGazer ----------------
  const [wgFps, tickWgFps, resetWgFps] = useSmoothedFps();
  const [xy, setXY] = useState({ x: null, y: null });

  useEffect(() => {
    const wg = window.webgazer;
    if (!wg) {
      console.error("WebGazer not loaded");
      return;
    }
    wg.setRegression("ridge").showVideoPreview(true).showPredictionPoints(true).begin();

    // 100ms마다 좌표 + FPS 계산
    const id = setInterval(async () => {
      const d = await wg.getCurrentPrediction();
      if (d && Number.isFinite(d.x) && Number.isFinite(d.y)) {
        setXY({ x: Math.round(d.x), y: Math.round(d.y) });
        tickWgFps();
        // 콘솔로 좌표 확인(원하면 주석 해제)
        // console.log(`WG X=${d.x.toFixed(1)} Y=${d.y.toFixed(1)}`);
      }
    }, 100);

    return () => {
      clearInterval(id);
      resetWgFps();
      wg.end?.();
    };
  }, []);

  // ---------------- MediaPipe FaceMesh ----------------
  const [mpFps, tickMpFps, resetMpFps] = useSmoothedFps();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mpReady, setMpReady] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    const ctx = canvasEl.getContext("2d");

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        // CDN에서 모델 파일을 받습니다.
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // 눈/입/홍채 정밀
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      // FPS 측정
      tickMpFps();

      // 그리기
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      ctx.save();
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length) {
        const landmarks = results.multiFaceLandmarks[0];
        // 랜드마크 점을 간단히 그리기
        ctx.fillStyle = "rgba(255,0,0,0.8)";
        for (const p of landmarks) {
          ctx.beginPath();
          ctx.arc(p.x * canvasEl.width, p.y * canvasEl.height, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // Camera Utils로 비디오 프레임을 FaceMesh로 전달
    const cam = new Camera(videoEl, {
      onFrame: async () => {
        await faceMesh.send({ image: videoEl });
      },
      width: 640,
      height: 480,
    });

    cam.start().then(() => setMpReady(true));

    return () => {
      try {
        cam.stop();
        resetMpFps();
      } catch {}
    };
  }, []);

  return (
    <div style={{ padding: 24, display: "grid", gap: 24 }}>
      <h1>시선 추적 스파이크: WebGazer & MediaPipe FaceMesh</h1>

      {/* WebGazer 상태 */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2>WebGazer</h2>
        <div>좌표: <b>{xy.x ?? "-"}</b>, <b>{xy.y ?? "-"}</b></div>
        <div>FPS: <b>{wgFps.toFixed(1)}</b></div>
        <p style={{color:"#666", marginTop:8}}>
          좌상단에 웹캠 미리보기/빨간 예측점이 보이면 정상 동작 중입니다.
        </p>
      </section>

      {/* MediaPipe FaceMesh 상태 */}
      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2>MediaPipe FaceMesh</h2>
        <div>FPS: <b>{mpFps.toFixed(1)}</b> {mpReady ? "" : "(초기화 중…)"}</div>

        {/* 비디오는 숨기고 캔버스만 표시 */}
        <div style={{ position: "relative", width: 640, height: 480 }}>
          <video ref={videoRef} style={{ display: "none" }} playsInline />
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", borderRadius: 8, boxShadow:"0 4px 16px rgba(0,0,0,.08)" }} />
        </div>
        <p style={{color:"#666", marginTop:8}}>
          캔버스에 얼굴 랜드마크(빨간 점)가 보이면 정상 동작입니다.
        </p>
      </section>
    </div>
  );
}
