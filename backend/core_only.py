# -*- coding: utf-8 -*-
import base64
import csv
import cv2
import os
import time
import threading
import asyncio
import json
import platform
import numpy as np
import mediapipe as mp
import websockets

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from gaze_pipeline import (
    MODE_CALIBRATION,
    MODE_TRACKING,
    get_head_pose,
    GazeCalibrator,
    apply_gaze_mapping,
    GazeSmoother,
    CALIBRATION_POINTS_NORM,
)

# ---------------------------
# 설정값
# ---------------------------
# macOS: 맥북 내장 카메라 우선 (인덱스 1), iPhone 연속성 카메라(0) 대신
CAM_INDEX = 1 if platform.system() == "Darwin" else 0
BLINK_TH = 0.20
BLINK_COOLDOWN_SEC = 0.35
WEBCAM_STREAM_FPS = 12  # 웹캠 프론트 전송 FPS (대역폭 절약)
WEBCAM_STREAM_SIZE = (320, 240)  # 전송 해상도

WS_CLIENTS = set()
WS_LOOP = None  # WebSocket 서버 스레드의 이벤트 루프 (다른 스레드에서 브로드캐스트용)
WS_HOST = "0.0.0.0"  # 모든 인터페이스에서 수신 (localhost, 172.x 등)
WS_PORT = 8765

gaze_calibrator = None
gaze_smoother = None
CALIBRATION_CSV_PATH = "calibration_data.csv"
FOLLOW_TARGET_CSV_PATH = "calibration_samples.csv"  # 정답 좌표 + gaze 저장 (모든 캘리브레이션)

# ---------------------------
# WebSocket 서버 및 전송 함수
# ---------------------------
def start_ws_server_in_background(calibrator):
    global gaze_calibrator, WS_LOOP
    gaze_calibrator = calibrator

    async def _broadcast_json_async(obj):
        if not WS_CLIENTS: return
        payload = json.dumps(obj)
        print(f"[WS] Broadcast: {payload}")  # 로그 추가
        await asyncio.gather(*[ws.send(payload) for ws in list(WS_CLIENTS)], return_exceptions=True)

    async def _ws_handler(websocket):
        print("[WS] 클라이언트 연결됨")
        WS_CLIENTS.add(websocket)
        try:
            async for raw in websocket:
                try:
                    print(f"[WS] 수신: {raw}")
                    msg = json.loads(raw)
                    if msg.get("type") == "calibration_start":
                        sw, sh = int(msg.get("screenWidth", 1920)), int(msg.get("screenHeight", 1080))
                        if gaze_calibrator:
                            gaze_calibrator.start_calibration(sw, sh)
                            nx, ny = CALIBRATION_POINTS_NORM[0]
                            await _broadcast_json_async({
                                "type": "calibration_show_point", "index": 0, "normX": nx, "normY": ny,
                            })
                    elif msg.get("type") == "follow_target_samples":
                        samples = msg.get("samples", [])
                        if samples:
                            _save_calibration_samples(samples, msg.get("source", "unknown"))
                except Exception as e:
                    print(f"[WS] 메시지 처리 오류: {e}")
        finally:
            print("[WS] 클라이언트 연결 해제")
            WS_CLIENTS.discard(websocket)

    def _run():
        global WS_LOOP
        async def _start_server():
            async with websockets.serve(_ws_handler, WS_HOST, WS_PORT) as server:
                print(f"WebSocket 서버 시작: ws://{WS_HOST}:{WS_PORT}")
                await asyncio.Future()  # 영원히 대기

        loop = asyncio.new_event_loop()
        WS_LOOP = loop
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_start_server())

    threading.Thread(target=_run, daemon=True).start()

def _save_calibration_samples(samples, source="unknown"):
    """캘리브레이션 샘플 저장 (정답 좌표 + gaze). target_x,y=정답, gaze_x,y=사용자 시선."""
    if not samples:
        return
    file_exists = os.path.isfile(FOLLOW_TARGET_CSV_PATH)
    try:
        with open(FOLLOW_TARGET_CSV_PATH, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if not file_exists:
                w.writerow(["source", "target_x", "target_y", "gaze_x", "gaze_y", "error"])
            for s in samples:
                tx = float(s.get("targetX", 0))
                ty = float(s.get("targetY", 0))
                gx = float(s.get("gazeX", 0))
                gy = float(s.get("gazeY", 0))
                err = ((tx - gx) ** 2 + (ty - gy) ** 2) ** 0.5
                w.writerow([source, tx, ty, gx, gy, round(err, 6)])
    except Exception as e:
        print(f"⚠️ calibration 저장 실패: {e}")

def _broadcast_json(obj):
    if not WS_CLIENTS or WS_LOOP is None:
        return
    payload = json.dumps(obj)
    print(f"[WS] Broadcast: {payload}")  # 로그 추가
    async def _send():
        await asyncio.gather(*[ws.send(payload) for ws in list(WS_CLIENTS)], return_exceptions=True)
    # 메인 스레드(cv2)에서 호출되므로, WebSocket 서버 루프에 전송 작업 예약
    asyncio.run_coroutine_threadsafe(_send(), WS_LOOP)

# ---------------------------
# 눈 관련 계산 (EAR) 및 랜드마크
# ---------------------------
LEFT_EYE_PTS = [33, 133, 159, 145] # outer, inner, top, bottom
RIGHT_EYE_PTS = [362, 263, 386, 374]

# iris landmark indices (MediaPipe FaceMesh / Face Landmarker)
LEFT_IRIS_PTS = [468, 469, 470, 471, 472]
RIGHT_IRIS_PTS = [473, 474, 475, 476, 477]

def get_iris_relative_position(landmarks):
    """
    홍채 중심을 각 눈의 윤곽 기준 상대좌표(0~1)로 변환.
    반환값: (avg_x_rel, avg_y_rel) 또는 None

    주의: 기존 코드처럼 얼굴 bbox 기준 정규화가 아니라
    눈 자체 기준 정규화를 사용하므로 위/아래 시선 변화에 더 민감하다.
    """
    if len(landmarks) < 478:
        return None

    left_iris = np.array([[landmarks[i].x, landmarks[i].y] for i in LEFT_IRIS_PTS], dtype=np.float64)
    right_iris = np.array([[landmarks[i].x, landmarks[i].y] for i in RIGHT_IRIS_PTS], dtype=np.float64)

    left_center = left_iris.mean(axis=0)
    right_center = right_iris.mean(axis=0)

    # 왼쪽 눈 기준 상대좌표
    l_outer, l_inner, l_top, l_bottom = [landmarks[i] for i in LEFT_EYE_PTS]
    l_dx = (l_inner.x - l_outer.x)
    l_dy = (l_bottom.y - l_top.y)
    if abs(l_dx) < 1e-6 or abs(l_dy) < 1e-6:
        return None
    left_x_rel = (left_center[0] - l_outer.x) / l_dx
    left_y_rel = (left_center[1] - l_top.y) / l_dy

    # 오른쪽 눈 기준 상대좌표
    r_outer, r_inner, r_top, r_bottom = [landmarks[i] for i in RIGHT_EYE_PTS]
    r_dx = (r_inner.x - r_outer.x)
    r_dy = (r_bottom.y - r_top.y)
    if abs(r_dx) < 1e-6 or abs(r_dy) < 1e-6:
        return None
    right_x_rel = (right_center[0] - r_outer.x) / r_dx
    right_y_rel = (right_center[1] - r_top.y) / r_dy

    avg_x_rel = np.clip((left_x_rel + right_x_rel) / 2.0, 0.0, 1.0)
    avg_y_rel = np.clip((left_y_rel + right_y_rel) / 2.0, 0.0, 1.0)
    return float(avg_x_rel), float(avg_y_rel)

def dist(a, b): return np.linalg.norm(np.array(a) - np.array(b))

def eye_ratio(landmarks, eye_indices, w, h):
    def pt(idx): return (landmarks[idx].x * w, landmarks[idx].y * h)
    v = dist(pt(eye_indices[2]), pt(eye_indices[3])) # top to bottom
    hor = dist(pt(eye_indices[0]), pt(eye_indices[1])) # outer to inner
    return v / (hor + 1e-6)

# ---------------------------
# 메인 루프
# ---------------------------
def main():
    global gaze_calibrator, gaze_smoother
    calibrator = GazeCalibrator(mapping_method="regression")
    gaze_calibrator = calibrator
    gaze_smoother = GazeSmoother()
    print("[WS] WebSocket 서버를 백그라운드로 시작합니다...")
    start_ws_server_in_background(calibrator)

    # macOS: CAP_AVFOUNDATION으로 맥북 내장 카메라 우선 선택
    cap_backend = cv2.CAP_AVFOUNDATION if platform.system() == "Darwin" else cv2.CAP_ANY
    cap = None
    cam_indices = [CAM_INDEX] + [i for i in [0, 1] if i != CAM_INDEX]
    for idx in cam_indices:
        cap = cv2.VideoCapture(idx, cap_backend)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"✅ 카메라 연결됨 (인덱스 {idx})")
                break
            cap.release()
            cap = None
    
    if not cap or not cap.isOpened():
        print("❌ 카메라 오픈 실패.")
        return

    base_options = python.BaseOptions(model_asset_path="face_landmarker.task")
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1
    )
    landmarker = vision.FaceLandmarker.create_from_options(options)

    blink_count, last_blink_time, prev_time = 0, 0.0, time.time()
    last_frame_send_time = 0.0
    if CALIBRATION_CSV_PATH and calibrator.load_calibration_csv(CALIBRATION_CSV_PATH):
        print(f"캘리브레이션 로드됨: {CALIBRATION_CSV_PATH}")
        print("⚠️ gaze feature를 얼굴 기준 -> iris 상대좌표로 바꿨다면 기존 calibration_data.csv는 다시 만드는 게 좋습니다.")

    print("시작. q를 눌러 종료하세요.")

    while True:
        ok, frame = cap.read()
        if not ok: break

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = landmarker.detect_for_video(mp_image, int(time.time() * 1000))

        now = time.time()
        fps = 1.0 / max(now - prev_time, 1e-6)
        prev_time = now
        status = "NO FACE"

        if res.face_landmarks:
            print("[Gaze] 얼굴 랜드마크 감지됨")
            lm = res.face_landmarks[0]
            
            # --- [시각화] 눈 윤곽 4점 + 홍채 10점 표시 ---
            for idx in (LEFT_EYE_PTS + RIGHT_EYE_PTS + LEFT_IRIS_PTS + RIGHT_IRIS_PTS):
                p = lm[idx]
                cv2.circle(frame, (int(p.x * w), int(p.y * h)), 2, (0, 255, 0), -1)

            r1 = eye_ratio(lm, LEFT_EYE_PTS, w, h)
            r2 = eye_ratio(lm, RIGHT_EYE_PTS, w, h)
            ratio = (r1 + r2) / 2.0
            status = f"EAR: {ratio:.3f}"

            # Iris & Gaze 로직
            iris_xy = get_iris_relative_position(lm)
            if iris_xy:
                print(f"[Gaze] iris_xy: {iris_xy}")
                px, py = iris_xy

                if gaze_calibrator.is_collecting:
                    res_c = gaze_calibrator.add_gaze_sample(px, py)
                    if res_c == "next":
                        ni = gaze_calibrator.current_index
                        _broadcast_json({"type": "calibration_show_point", "index": ni, "normX": CALIBRATION_POINTS_NORM[ni][0], "normY": CALIBRATION_POINTS_NORM[ni][1]})
                    elif res_c == "complete":
                        gaze_smoother.reset()
                        if CALIBRATION_CSV_PATH: gaze_calibrator.save_calibration_csv(CALIBRATION_CSV_PATH)
                        _broadcast_json({"type": "calibration_complete"})
                    # 캘리브레이션 중에도 시선 좌표 전송 (프론트에서 점 이동 확인용)
                    ox, oy = gaze_smoother.update(max(0, min(1, px)), max(0, min(1, py)))
                    _broadcast_json({"type": "gaze", "x": float(ox), "y": float(oy)})
                elif gaze_calibrator.has_valid_model():
                    s_xy = apply_gaze_mapping(gaze_calibrator, px, py)
                    if s_xy:
                        ox, oy = gaze_smoother.update(s_xy[0], s_xy[1])
                        _broadcast_json({"type": "gaze", "x": float(max(0, min(1, ox))), "y": float(max(0, min(1, oy)))})
                    else:
                        ox, oy = gaze_smoother.update(max(0, min(1, px)), max(0, min(1, py)))
                        _broadcast_json({"type": "gaze", "x": float(ox), "y": float(oy)})
                else:
                    # 캘리브레이션 없을 때 fallback: 얼굴 기준 좌표 전송 (대략적, 스무딩 적용)
                    ox, oy = gaze_smoother.update(max(0, min(1, px)), max(0, min(1, py)))
                    _broadcast_json({"type": "gaze", "x": float(ox), "y": float(oy)})

            if ratio < BLINK_TH and (now - last_blink_time) > BLINK_COOLDOWN_SEC:
                blink_count += 1
                last_blink_time = now
                _broadcast_json({"type": "blink"})

        cv2.putText(frame, f"FPS: {fps:.1f} BLINK: {blink_count}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        # 웹캠 프레임 WebSocket으로 프론트에 전송 (얼굴 미리보기용)
        if WS_CLIENTS and (now - last_frame_send_time) >= (1.0 / WEBCAM_STREAM_FPS):
            try:
                small = cv2.resize(frame, WEBCAM_STREAM_SIZE)
                _, jpg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 75])
                b64_str = base64.b64encode(jpg).decode("ascii")
                _broadcast_json({"type": "frame", "data": b64_str})
                last_frame_send_time = now
            except Exception:
                pass
        cv2.imshow("Gaze Tracker", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()