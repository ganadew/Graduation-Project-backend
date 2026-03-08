# -*- coding: utf-8 -*-
import cv2
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
    get_face_bbox_from_landmarks,
    get_pupil_position,
    get_head_pose,
    normalize_to_face_relative,
    GazeCalibrator,
    apply_gaze_mapping,
    GazeSmoother,
    CALIBRATION_POINTS_NORM,
)

# ---------------------------
# 설정값
# ---------------------------
# 맥북: 0=기본(아이폰 연속성 카메라일 수 있음), 1=맥북 내장 FaceTime HD 카메라
# 맥북 내장 카메라 우선 사용
if platform.system() == "Darwin":
    CAM_INDEX = 1  # 맥북 내장 카메라 (아이폰이 0번일 때)
else:
    CAM_INDEX = 0
BLINK_TH = 0.20
BLINK_COOLDOWN_SEC = 0.35

WS_CLIENTS = set()
WS_HOST = "localhost"
WS_PORT = 8765

# 시선 파이프라인 전역 (메인 루프와 WebSocket 핸들러에서 공유)
gaze_calibrator = None
gaze_smoother = None

# 캘리브레이션 데이터 CSV 저장 경로 (None이면 저장 안 함)
CALIBRATION_CSV_PATH = "calibration_data.csv"


def start_ws_server_in_background(calibrator):
    """WebSocket 서버를 백그라운드에서 실행. calibrator 공유."""
    global gaze_calibrator
    gaze_calibrator = calibrator

    async def _broadcast_json_async(obj):
        if not WS_CLIENTS:
            return
        payload = json.dumps(obj)
        await asyncio.gather(
            *[ws.send(payload) for ws in list(WS_CLIENTS)],
            return_exceptions=True,
        )

    async def _ws_handler(websocket):
        global gaze_calibrator
        WS_CLIENTS.add(websocket)
        try:
            async for raw in websocket:
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "calibration_start":
                        sw = int(msg.get("screenWidth", 1920))
                        sh = int(msg.get("screenHeight", 1080))
                        if gaze_calibrator is not None:
                            gaze_calibrator.start_calibration(sw, sh)
                            idx = 0
                            nx, ny = CALIBRATION_POINTS_NORM[idx][0], CALIBRATION_POINTS_NORM[idx][1]
                            await _broadcast_json_async({
                                "type": "calibration_show_point",
                                "index": idx,
                                "normX": nx,
                                "normY": ny,
                            })
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
        finally:
            WS_CLIENTS.discard(websocket)

    async def _run():
        async with websockets.serve(_ws_handler, WS_HOST, WS_PORT):
            print(f"WebSocket 서버 시작: ws://{WS_HOST}:{WS_PORT}")
            await asyncio.Future()

    def _thread_target():
        asyncio.run(_run())

    t = threading.Thread(target=_thread_target, daemon=True)
    t.start()


def _broadcast_to_clients(message: str):
    async def _broadcast():
        if not WS_CLIENTS:
            return
        await asyncio.gather(
            *[ws.send(message) for ws in list(WS_CLIENTS)],
            return_exceptions=True,
        )
    try:
        asyncio.run(_broadcast())
    except RuntimeError:
        pass


def _broadcast_json(obj):
    _broadcast_to_clients(json.dumps(obj))


def notify_blink_to_clients():
    _broadcast_to_clients(json.dumps({"type": "blink"}))


def send_gaze_to_clients(norm_x: float, norm_y: float):
    """0~1 화면 정규화 시선 좌표 전송 (프론트에서 * window 크기 사용)."""
    _broadcast_to_clients(json.dumps({
        "type": "gaze",
        "x": float(norm_x),
        "y": float(norm_y),
    }))


# ---------------------------
# 블링크: 눈 비율(EAR)
# ---------------------------
LEFT_EYE = {"outer": 33, "inner": 133, "top": 159, "bottom": 145}
RIGHT_EYE = {"outer": 362, "inner": 263, "top": 386, "bottom": 374}


def dist(a, b):
    return np.linalg.norm(np.array(a) - np.array(b))


def eye_ratio(landmarks, eye, w, h):
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
    global gaze_calibrator, gaze_smoother
    # mapping_method: "regression"(LinearRegression) 또는 "affine"(아핀 변환)
    calibrator = GazeCalibrator(mapping_method="regression")
    gaze_calibrator = calibrator
    gaze_smoother = GazeSmoother()
    start_ws_server_in_background(calibrator)

    # 맥북: 내장 카메라(1번) 우선, 실패 시 0번 시도
    cap = None
    indices = [1, 0] if platform.system() == "Darwin" else [0]
    for idx in indices:
        cap = cv2.VideoCapture(idx, cv2.CAP_AVFOUNDATION if platform.system() == "Darwin" else cv2.CAP_ANY)
        if cap.isOpened():
            ok, _ = cap.read()
            if ok:
                print(f"카메라 연결됨 (인덱스 {idx})")
                break
        if cap:
            cap.release()
        cap = None
    if cap is None or not cap.isOpened():
        print("카메라 오픈 실패. 시스템 환경설정 > 개인 정보 보호 > 카메라에서 권한을 확인하세요.")
        return

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

    # 저장된 캘리브레이션 있으면 로드
    if CALIBRATION_CSV_PATH and calibrator.load_calibration_csv(CALIBRATION_CSV_PATH):
        print(f"캘리브레이션 로드됨: {CALIBRATION_CSV_PATH}")
    print("시작. q 또는 ESC로 종료. 프론트에서 '보정' 요청 시 5점 보정 진행.")

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        ts_ms = int(time.time() * 1000)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = landmarker.detect_for_video(mp_image, ts_ms)

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
            status = f"EAR: {ratio:.3f}"

            # Head pose (yaw, pitch, roll) - 시선 보정 보조용
            head_pose = get_head_pose(lm, w, h)
            if head_pose is not None:
                yaw, pitch, roll = head_pose
                status += f" Y:{yaw:.0f} P:{pitch:.0f} R:{roll:.0f}"

            # 1) Pupil position (pupil_x, pupil_y) - 이미지 정규화 0~1
            pupil_xy = get_pupil_position(lm)
            if pupil_xy is not None:
                # 2) 정규화: pupil_x_norm, pupil_y_norm (얼굴 bbox 기준 0~1)
                face_bbox = get_face_bbox_from_landmarks(lm)
                pupil_x_norm, pupil_y_norm = normalize_to_face_relative(
                    pupil_xy[0], pupil_xy[1], face_bbox
                )

                # 3) calibration_mode: 보정 데이터 수집
                if gaze_calibrator is not None and gaze_calibrator.is_collecting:
                    result = gaze_calibrator.add_gaze_sample(pupil_x_norm, pupil_y_norm)
                    if result == "next":
                        idx = gaze_calibrator.current_index
                        nx, ny = CALIBRATION_POINTS_NORM[idx][0], CALIBRATION_POINTS_NORM[idx][1]
                        _broadcast_json({
                            "type": "calibration_show_point",
                            "index": idx,
                            "normX": nx,
                            "normY": ny,
                        })
                    elif result == "complete":
                        gaze_smoother.reset()
                        # 캘리브레이션 CSV 저장
                        if CALIBRATION_CSV_PATH and gaze_calibrator.save_calibration_csv(CALIBRATION_CSV_PATH):
                            status += " [CSV saved]"
                        _broadcast_json({"type": "calibration_complete"})
                        if not gaze_calibrator.has_valid_model():
                            status += " [CALIB FAIL]"
                        else:
                            status += " [CALIB OK]"

                # 4) tracking_mode: 보정 완료 후 시선 -> 화면 좌표 매핑
                if gaze_calibrator is not None and gaze_calibrator.has_valid_model():
                    screen_norm_xy = apply_gaze_mapping(
                        gaze_calibrator, pupil_x_norm, pupil_y_norm
                    )
                    if screen_norm_xy is not None:
                        # 5) Low-pass 스무딩 & clamp to [0,1]
                        out_x, out_y = gaze_smoother.update(screen_norm_xy[0], screen_norm_xy[1])
                        out_x = max(0.0, min(1.0, out_x))
                        out_y = max(0.0, min(1.0, out_y))
                        send_gaze_to_clients(out_x, out_y)

            # 블링크
            if ratio is not None and ratio < BLINK_TH and (now - last_blink_time) > BLINK_COOLDOWN_SEC:
                blink_count += 1
                last_blink_time = now
                status += "  BLINK!"
                notify_blink_to_clients()

            # 눈 랜드마크 시각화
            for idx in [
                LEFT_EYE["outer"], LEFT_EYE["inner"], LEFT_EYE["top"], LEFT_EYE["bottom"],
                RIGHT_EYE["outer"], RIGHT_EYE["inner"], RIGHT_EYE["top"], RIGHT_EYE["bottom"],
            ]:
                p = lm[idx]
                cx, cy = int(p.x * w), int(p.y * h)
                cv2.circle(frame, (cx, cy), 3, (0, 255, 0), -1)

        cv2.putText(frame, f"FPS: {fps:.1f}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        cv2.putText(frame, status, (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.putText(frame, f"BLINK: {blink_count}", (20, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        cv2.imshow("core_only (Gaze + Calibration)", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
