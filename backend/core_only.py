# -*- coding: utf-8 -*-
import cv2
import time
import threading
import asyncio
import json
import numpy as np
import mediapipe as mp
import websockets

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ---------------------------
# 설정값 (여기만 조절하면 됨)
# ---------------------------
CAM_INDEX = 1              # 보통 0=아이폰(연속성), 1=맥북 내장
BLINK_TH = 0.20            # 작을수록 덜 민감(오클릭↓), 클수록 더 민감(인식↑)
BLINK_COOLDOWN_SEC = 0.35  # 연속 블링크 중복 카운트 방지

# WebSocket 클라이언트들을 관리하기 위한 전역 세트
WS_CLIENTS = set()
WS_HOST = "localhost"
WS_PORT = 8765


async def _ws_handler(websocket):
    """프론트엔드(React)가 접속하는 WebSocket 핸들러."""
    WS_CLIENTS.add(websocket)
    try:
        async for _ in websocket:
            # 지금은 서버에서 보내기만 하고, 클라이언트 메시지는 사용하지 않음
            pass
    finally:
        WS_CLIENTS.discard(websocket)


def start_ws_server_in_background():
    """별도 스레드에서 WebSocket 서버 실행."""

    async def _run():
        async with websockets.serve(_ws_handler, WS_HOST, WS_PORT):
            print(f"🌐 WebSocket 서버 시작: ws://{WS_HOST}:{WS_PORT}")
            await asyncio.Future()  # 서버를 계속 유지

    def _thread_target():
        asyncio.run(_run())

    t = threading.Thread(target=_thread_target, daemon=True)
    t.start()


def _broadcast_to_clients(message: str):
    """모든 WebSocket 클라이언트에 문자열 메시지를 전송."""

    async def _broadcast():
        if not WS_CLIENTS:
            return
        await asyncio.gather(
            *[ws.send(message) for ws in list(WS_CLIENTS)],
            return_exceptions=True,
        )

    # core 루프는 asyncio를 쓰지 않으므로, 매번 간단히 run
    try:
        asyncio.run(_broadcast())
    except RuntimeError:
        # 이미 다른 이벤트 루프가 돌고 있다면 여기서는 무시
        pass


def notify_blink_to_clients():
    """블링크가 감지되었을 때 'blink' 타입 이벤트 전송."""
    msg = json.dumps({"type": "blink"})
    _broadcast_to_clients(msg)


def send_gaze_to_clients(norm_x: float, norm_y: float):
    """0~1 범위의 시선 좌표를 프론트로 전송."""
    msg = json.dumps(
        {
            "type": "gaze",
            "x": float(norm_x),
            "y": float(norm_y),
        }
    )
    _broadcast_to_clients(msg)


# FaceLandmarker(=FaceMesh 계열)에서 많이 쓰는 눈 랜드마크 인덱스
LEFT_EYE = {"outer": 33, "inner": 133, "top": 159, "bottom": 145}
RIGHT_EYE = {"outer": 362, "inner": 263, "top": 386, "bottom": 374}

def dist(a, b):
    return np.linalg.norm(np.array(a) - np.array(b))

def eye_ratio(landmarks, eye, w, h):
    """
    EAR 비슷한 값 = 세로/가로
    landmarks는 normalized(0~1)이므로 픽셀로 변환해서 거리 계산
    """
    def pt(idx):
        p = landmarks[idx]
        return (p.x * w, p.y * h)

    top = pt(eye["top"])
    bottom = pt(eye["bottom"])
    outer = pt(eye["outer"])
    inner = pt(eye["inner"])

    v = dist(top, bottom)
    hor = dist(outer, inner)
    return v / (hor + 1e-6)

def main():
    # WebSocket 서버를 백그라운드에서 시작
    start_ws_server_in_background()

    # 1) 카메라 열기
    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        print("❌ 카메라 오픈 실패.")
        print("   - CAM_INDEX를 0/1/2로 바꿔보거나")
        print("   - macOS 카메라 권한(터미널/파이썬/VSCode) 확인해줘.")
        return

    # 2) FaceLandmarker(Task) 로드
    # 같은 폴더에 face_landmarker.task 파일이 있어야 함
    base_options = python.BaseOptions(model_asset_path="face_landmarker.task")
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    landmarker = vision.FaceLandmarker.create_from_options(options)

    blink_count = 0
    last_blink_time = 0.0
    prev_time = time.time()

    print("✅ 시작! OpenCV 창에서 q 또는 ESC로 종료")

    while True:
        ok, frame = cap.read()
        if not ok:
            print("❌ 프레임 읽기 실패")
            break

        # 거울 모드
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # BGR -> RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # 3) mediapipe Image 만들고 추론
        ts_ms = int(time.time() * 1000)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = landmarker.detect_for_video(mp_image, ts_ms)

        # FPS 계산
        now = time.time()
        fps = 1.0 / max(now - prev_time, 1e-6)
        prev_time = now

        status = "NO FACE"
        ratio = None

        if res.face_landmarks and len(res.face_landmarks) > 0:
            lm = res.face_landmarks[0]

            r1 = eye_ratio(lm, LEFT_EYE, w, h)
            r2 = eye_ratio(lm, RIGHT_EYE, w, h)
            ratio = (r1 + r2) / 2.0

            status = f"EAR-like: {ratio:.3f}"

            # 간단한 시선 좌표: 양쪽 눈 중앙의 중간지점을 사용 (0~1 정규화)
            left_inner = lm[LEFT_EYE["inner"]]
            right_inner = lm[RIGHT_EYE["inner"]]
            gaze_x = (left_inner.x + right_inner.x) / 2.0
            gaze_y = (left_inner.y + right_inner.y) / 2.0

            send_gaze_to_clients(gaze_x, gaze_y)

            # 4) 블링크 감지(쿨다운 포함)
            if ratio < BLINK_TH and (now - last_blink_time) > BLINK_COOLDOWN_SEC:
                blink_count += 1
                last_blink_time = now
                status += "  BLINK!"

                # 눈 깜빡임 이벤트를 프론트엔드(React)로 전송
                notify_blink_to_clients()

            # 5) 눈 점 표시(디버깅)
            for idx in [
                LEFT_EYE["outer"], LEFT_EYE["inner"], LEFT_EYE["top"], LEFT_EYE["bottom"],
                RIGHT_EYE["outer"], RIGHT_EYE["inner"], RIGHT_EYE["top"], RIGHT_EYE["bottom"],
            ]:
                p = lm[idx]
                cx, cy = int(p.x * w), int(p.y * h)
                cv2.circle(frame, (cx, cy), 3, (0, 255, 0), -1)

        # HUD 표시
        cv2.putText(frame, f"FPS: {fps:.1f}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        cv2.putText(frame, status, (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.putText(frame, f"BLINK COUNT: {blink_count}", (20, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.putText(frame, f"TH={BLINK_TH:.2f} cooldown={BLINK_COOLDOWN_SEC:.2f}s",
                    (20, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)

        cv2.imshow("core_only (MediaPipe Tasks + Blink)", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
