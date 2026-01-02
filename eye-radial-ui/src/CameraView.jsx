import React, { useEffect, useRef } from "react";

export default function CameraView() {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("카메라 접근 실패:", err);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="camera-view-video"
      autoPlay
      playsInline
      muted
    />
  );
}


