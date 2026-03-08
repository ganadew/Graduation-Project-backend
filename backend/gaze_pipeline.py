# -*- coding: utf-8 -*-
"""
시선 추적 파이프라인: 얼굴 기준 정규화, 5점 보정, 매핑, 스무딩.
- pupil detection: 눈 중심(동공 대리) 추출
- normalization: 얼굴 bbox 기준 0~1 좌표 (pupil_x_norm, pupil_y_norm)
- calibration: 5점 보정 및 변환 행렬/회귀 모델 계산
- mapping: 정규화 시선 -> 화면 좌표 (아핀 또는 LinearRegression)
- smoothing: Low-pass 지수 스무딩 (시선 좌표 튐 방지)
"""
import time
import os
import csv
import numpy as np
import cv2

# ---------------------------------------------------------------------------
# 동작 모드: calibration_mode(보정 수집) vs tracking_mode(시선 추적)
# ---------------------------------------------------------------------------
MODE_CALIBRATION = "calibration"   # 5점 보정 데이터 수집 중
MODE_TRACKING = "tracking"         # 보정 완료 후 시선 좌표 추출 중

# MediaPipe Face Landmarker 눈 인덱스
LEFT_EYE = {"outer": 33, "inner": 133, "top": 159, "bottom": 145}
RIGHT_EYE = {"outer": 362, "inner": 263, "top": 386, "bottom": 374}

# Head pose용 3D 얼굴 모델 참조점 (MediaPipe 468 포인트 기반 6점)
# nose tip, chin, left eye outer, right eye outer, left mouth, right mouth
HEAD_POSE_3D_MODEL = np.array([
    (0.0, 0.0, 0.0),      # nose tip
    (0.0, -330.0, -65.0),  # chin
    (-225.0, 170.0, -135.0),   # left eye outer
    (225.0, 170.0, -135.0),   # right eye outer
    (-150.0, -150.0, -125.0),  # left mouth
    (150.0, -150.0, -125.0),   # right mouth
], dtype=np.float64)

# 5점 보정 위치 (화면 정규화 0~1): 중심, 좌상, 우상, 좌하, 우하
CALIBRATION_POINTS_NORM = [
    (0.5, 0.5),   # center
    (0.1, 0.1),   # top-left
    (0.9, 0.1),   # top-right
    (0.1, 0.9),   # bottom-left
    (0.9, 0.9),   # bottom-right
]
CALIBRATION_SAMPLE_DURATION_SEC = 0.7
CALIBRATION_SETTLE_SEC = 0.25          # 점 이동 후 눈이 안정화될 시간(transition 샘플 제거)
CALIBRATION_MIN_SAMPLES = 12           # 점당 최소 샘플 수 (FPS 낮아도 너무 적게 평균내지 않도록)
CALIBRATION_MAX_DURATION_SEC = 1.6     # 분산이 높으면 최대 이 시간까지 더 수집
CALIBRATION_STD_THRESHOLD = 0.035      # (x,y) 표준편차가 이 값 이하일 때만 '안정'으로 간주
SMOOTHING_ALPHA = 0.6                  # 0~1, 낮을수록 더 스무딩 (low-pass cutoff)
SMOOTHING_DEADZONE = 0.003             # 너무 작은 흔들림은 무시(지터 감소)


# ---------------------------------------------------------------------------
# 1) Pupil detection (눈 중심 = 시선 대리)
# ---------------------------------------------------------------------------

def get_face_bbox_from_landmarks(landmarks):
    """
    랜드마크에서 얼굴 경계 상자 계산 (정규화 0~1).
    Returns: (x_min, y_min, x_max, y_max)
    """
    xs = [p.x for p in landmarks]
    ys = [p.y for p in landmarks]
    return (min(xs), min(ys), max(xs), max(ys))


def get_pupil_position(landmarks):
    """
    양쪽 눈 내측 중심을 시선 대리점(pupil_x, pupil_y)으로 사용.
    실제 동공 검출 대신 눈 랜드마크 기반 근사치 사용 (MediaPipe 한계).
    Returns: (pupil_x, pupil_y) 이미지 정규화 0~1, 또는 None
    """
    left_inner = landmarks[LEFT_EYE["inner"]]
    right_inner = landmarks[RIGHT_EYE["inner"]]
    pupil_x = (left_inner.x + right_inner.x) / 2.0
    pupil_y = (left_inner.y + right_inner.y) / 2.0
    return (pupil_x, pupil_y)


def get_head_pose(landmarks, frame_width, frame_height):
    """
    MediaPipe 3D 랜드마크로 head pose(요, 피치, 롤) 추정.
    6점 PnP 기반. solvePnP 사용.
    Returns: (yaw_deg, pitch_deg, roll_deg) 또는 None
    """
    # MediaPipe 468 포인트 인덱스 (face_landmarker)
    INDICES = [1, 152, 33, 263, 61, 291]  # nose, chin, L eye, R eye, L mouth, R mouth
    try:
        image_points = np.array([
            (landmarks[i].x * frame_width, landmarks[i].y * frame_height)
            for i in INDICES if i < len(landmarks)
        ], dtype=np.float64)
        if len(image_points) < 6:
            return None
        _, rvec, tvec = cv2.solvePnP(
            HEAD_POSE_3D_MODEL[:len(image_points)],
            image_points,
            _get_camera_matrix(frame_width, frame_height),
            np.zeros(4),
            flags=cv2.SOLVEPNP_ITERATIVE
        )
        rmat, _ = cv2.Rodrigues(rvec)
        # 오일러 각도 추출 (도 단위)
        sy = np.sqrt(rmat[0, 0]**2 + rmat[1, 0]**2)
        if sy > 1e-6:
            yaw = np.arctan2(rmat[1, 0], rmat[0, 0])
            pitch = np.arctan2(-rmat[2, 0], sy)
            roll = np.arctan2(rmat[2, 1], rmat[2, 2])
        else:
            yaw = np.arctan2(-rmat[1, 2], rmat[1, 1])
            pitch = np.arctan2(-rmat[2, 0], sy)
            roll = 0.0
        return (np.degrees(yaw), np.degrees(pitch), np.degrees(roll))
    except Exception:
        return None


def _get_camera_matrix(w, h):
    """근사 카메라 행렬 (초점거리 추정)."""
    fx = fy = max(w, h)
    cx, cy = w / 2.0, h / 2.0
    return np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float64)


# ---------------------------------------------------------------------------
# 2) Normalization: 얼굴 bbox 기준 0~1
# ---------------------------------------------------------------------------

def normalize_to_face_relative(pupil_x, pupil_y, face_bbox):
    """
    픽셀/이미지 정규화된 눈 위치를 얼굴 bbox 기준 0~1로 변환.
    pupil_x_norm, pupil_y_norm = 얼굴 상대 좌표 (0~1).
    face_bbox: (x_min, y_min, x_max, y_max) 정규화 좌표
    Returns: (pupil_x_norm, pupil_y_norm) in [0, 1], 경계 밖은 clamp
    """
    x_min, y_min, x_max, y_max = face_bbox
    w = max(x_max - x_min, 1e-6)
    h = max(y_max - y_min, 1e-6)
    nx = (pupil_x - x_min) / w
    ny = (pupil_y - y_min) / h
    nx = max(0.0, min(1.0, nx))
    ny = max(0.0, min(1.0, ny))
    return (nx, ny)


# ---------------------------------------------------------------------------
# 3) Calibration: 5점 수집, CSV 저장/불러오기, 회귀 모델 학습
# ---------------------------------------------------------------------------

class GazeCalibrator:
    """
    5점 보정: 각 점마다 ~0.7초 샘플 수집 -> 평균 시선 벡터 저장
    - cv2.estimateAffine2D: 아핀 변환 (기본)
    - scikit-learn LinearRegression: 회귀 기반 보정 (선택)
    - CSV 저장/불러오기 지원
    """

    # 매핑 방식: "affine" 또는 "regression"
    def __init__(self, mapping_method="regression"):
        self.screen_width = 1920
        self.screen_height = 1080
        self.points_screen = []
        self.points_gaze = []
        self.current_index = 0
        self.samples = []
        self.collect_start_time = None
        self.settle_until = None
        self.is_collecting = False
        self.mapping_method = mapping_method  # "affine" | "regression"
        self._reg_model_x = None   # LinearRegression for screen_x
        self._reg_model_y = None   # LinearRegression for screen_y
        self._affine_matrix = None

    def start_calibration(self, screen_width, screen_height):
        """calibration_mode 진입: 보정 데이터 수집 시작."""
        self.screen_width = max(1, screen_width)
        self.screen_height = max(1, screen_height)
        self.points_screen = []
        self.points_gaze = []
        self.current_index = 0
        self.samples = []
        self.collect_start_time = None
        self.settle_until = None
        self.is_collecting = True

    def get_current_target_norm(self):
        """현재 보정 점의 화면 정규화 좌표 (0~1)."""
        if self.current_index >= len(CALIBRATION_POINTS_NORM):
            return None
        return CALIBRATION_POINTS_NORM[self.current_index]

    def get_current_target_screen_norm(self):
        """현재 보정 점의 화면 정규화 좌표(0~1)."""
        return self.get_current_target_norm()

    def add_gaze_sample(self, norm_gaze_x, norm_gaze_y):
        """
        calibration_mode: 한 프레임의 정규화 시선 추가.
        Returns: "next" | "complete" | None
        """
        if not self.is_collecting or self.current_index >= len(CALIBRATION_POINTS_NORM):
            return None
        now = time.time()
        if self.collect_start_time is None:
            self.collect_start_time = now
            self.settle_until = now + CALIBRATION_SETTLE_SEC

        if self.settle_until is not None and now >= self.settle_until:
            self.samples.append((float(norm_gaze_x), float(norm_gaze_y)))

        collect_elapsed = max(0.0, now - self.settle_until) if self.settle_until else 0.0
        if collect_elapsed < CALIBRATION_SAMPLE_DURATION_SEC or len(self.samples) < CALIBRATION_MIN_SAMPLES:
            if (now - self.collect_start_time) < CALIBRATION_MAX_DURATION_SEC:
                return None

        arr = np.array(self.samples, dtype=np.float64) if self.samples else None
        if arr is None or len(arr) < 3:
            return None

        std_x, std_y = float(np.std(arr[:, 0])), float(np.std(arr[:, 1]))
        stable = (std_x <= CALIBRATION_STD_THRESHOLD) and (std_y <= CALIBRATION_STD_THRESHOLD)
        if not stable and (now - self.collect_start_time) < CALIBRATION_MAX_DURATION_SEC:
            return None

        mean_gx, mean_gy = float(np.mean(arr[:, 0])), float(np.mean(arr[:, 1]))
        tx, ty = self.get_current_target_screen_norm()
        self.points_screen.append([tx, ty])
        self.points_gaze.append([mean_gx, mean_gy])
        self.current_index += 1
        self.samples = []
        self.collect_start_time = None
        self.settle_until = None
        if self.current_index >= len(CALIBRATION_POINTS_NORM):
            self.is_collecting = False
            self._fit_model()
            return "complete"
        return "next"

    def _fit_model(self):
        """보정 데이터로 아핀/회귀 모델 학습."""
        if len(self.points_gaze) < 3:
            return
        X = np.array(self.points_gaze, dtype=np.float64)
        Y = np.array(self.points_screen, dtype=np.float64)
        if self.mapping_method == "regression":
            try:
                from sklearn.linear_model import LinearRegression
                self._reg_model_x = LinearRegression()
                self._reg_model_y = LinearRegression()
                self._reg_model_x.fit(X, Y[:, 0])
                self._reg_model_y.fit(X, Y[:, 1])
                self._affine_matrix = None

                print("🔥 FIT MODEL 실행됨")
                print("X 모델 coef:", self._reg_model_x.coef_)
                print("X 모델 intercept:", self._reg_model_x.intercept_)
                print("Y 모델 coef:", self._reg_model_y.coef_)
                print("Y 모델 intercept:", self._reg_model_y.intercept_)
            except ImportError:
                self.mapping_method = "affine"
                self._fit_model()
                return
        if self.mapping_method == "affine" or self._affine_matrix is None:
            src, dst = X, Y
            M, _ = cv2.estimateAffine2D(src, dst, method=cv2.LMEDS)
            self._affine_matrix = M
            self._reg_model_x = self._reg_model_y = None

    def get_affine_matrix(self):
        """아핀 매핑 사용 시 2x3 행렬 반환."""
        return self._affine_matrix

    def get_regression_models(self):
        """회귀 매핑 사용 시 (model_x, model_y) 반환."""
        return (self._reg_model_x, self._reg_model_y)

    def get_mapping_method(self):
        return self.mapping_method

    def has_valid_model(self):
        """tracking_mode 사용 가능 여부 (보정 완료 및 모델 학습됨)."""
        if self.mapping_method == "regression":
            return self._reg_model_x is not None and self._reg_model_y is not None
        return self._affine_matrix is not None

    def get_screen_size(self):
        return (self.screen_width, self.screen_height)

    def save_calibration_csv(self, filepath="calibration_data.csv"):
        """
        캘리브레이션 데이터를 CSV로 저장.
        형식: screen_x,screen_y,gaze_x,gaze_y (화면/시선 정규화 0~1)
        """
        if len(self.points_screen) < 3:
            return False
        try:
            with open(filepath, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["screen_x", "screen_y", "gaze_x", "gaze_y"])
                for (sx, sy), (gx, gy) in zip(self.points_screen, self.points_gaze):
                    w.writerow([sx, sy, gx, gy])
                w.writerow(["#", "screen_width", str(self.screen_width)])
                w.writerow(["#", "screen_height", str(self.screen_height)])
            return True
        except Exception:
            return False

    def load_calibration_csv(self, filepath="calibration_data.csv"):
        """
        CSV에서 캘리브레이션 데이터 불러오기 및 모델 재학습.
        Returns: True if loaded and fitted, False otherwise
        """
        if not os.path.isfile(filepath):
            return False
        try:
            points_screen, points_gaze = [], []
            sw, sh = 1920, 1080
            with open(filepath, "r", encoding="utf-8") as f:
                r = csv.reader(f)
                header = next(r, None)
                for row in r:
                    if not row or row[0].startswith("#"):
                        if len(row) >= 3 and row[1] == "screen_width":
                            sw = int(row[2])
                        elif len(row) >= 3 and row[1] == "screen_height":
                            sh = int(row[2])
                        continue
                    if len(row) >= 4:
                        points_screen.append([float(row[0]), float(row[1])])
                        points_gaze.append([float(row[2]), float(row[3])])
            if len(points_screen) < 3:
                return False
            self.points_screen = points_screen
            self.points_gaze = points_gaze
            self.screen_width, self.screen_height = sw, sh
            self._fit_model()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 4) Mapping: 정규화 시선 -> 화면 좌표 (아핀 또는 LinearRegression)
# ---------------------------------------------------------------------------

def apply_affine_map(matrix_2x3, norm_gaze_x, norm_gaze_y):
    """
    2x3 아핀 행렬로 정규화 시선 -> 화면 정규화 좌표(0~1).
    """
    if matrix_2x3 is None:
        return None
    pts = np.array([[[norm_gaze_x, norm_gaze_y]]], dtype=np.float64)
    out = cv2.transform(pts, matrix_2x3)
    return (float(out[0, 0, 0]), float(out[0, 0, 1]))


def apply_regression_map(model_x, model_y, norm_gaze_x, norm_gaze_y):
    """
    scikit-learn LinearRegression으로 정규화 시선 -> 화면 정규화 좌표(0~1).
    입력: (gaze_x, gaze_y) -> 출력: (screen_x, screen_y)
    """
    if model_x is None or model_y is None:
        return None
    inp = np.array([[norm_gaze_x, norm_gaze_y]], dtype=np.float64)
    sx = float(model_x.predict(inp)[0])
    sy = float(model_y.predict(inp)[0])
    return (sx, sy)


def apply_gaze_mapping(calibrator, norm_gaze_x, norm_gaze_y):
    """
    GazeCalibrator의 학습된 모델(아핀 또는 회귀)로 시선 매핑.
    tracking_mode에서 사용. calibrator는 보정 완료된 상태여야 함.
    """
    if calibrator is None:
        return None
    if calibrator.get_mapping_method() == "regression":
        mx, my = calibrator.get_regression_models()
        return apply_regression_map(mx, my, norm_gaze_x, norm_gaze_y)
    M = calibrator.get_affine_matrix()
    return apply_affine_map(M, norm_gaze_x, norm_gaze_y)


# ---------------------------------------------------------------------------
# 5) Low-pass 스무딩: 시선 좌표 튐 방지 (지수 이동 평균 = 1-pole low-pass)
# ---------------------------------------------------------------------------

class GazeSmoother:
    """
    Low-pass 스무딩 필터 (지수 이동 평균).
    out = alpha * prev + (1 - alpha) * current
    alpha가 클수록 더 부드럽지만 반응이 느림. deadzone으로 미세 지터 제거.
    """

    def __init__(self, alpha=SMOOTHING_ALPHA, deadzone=SMOOTHING_DEADZONE):
        self.alpha = alpha      # 0~1, 스무딩 강도 (높을수록 더 스무딩)
        self.deadzone = deadzone
        self.x = None
        self.y = None

    def update(self, x, y):
        if self.x is None:
            self.x, self.y = x, y
            return (x, y)
        next_x = self.alpha * self.x + (1 - self.alpha) * x
        next_y = self.alpha * self.y + (1 - self.alpha) * y
        if abs(next_x - self.x) < self.deadzone:
            next_x = self.x
        if abs(next_y - self.y) < self.deadzone:
            next_y = self.y
        self.x, self.y = next_x, next_y
        return (self.x, self.y)

    def reset(self):
        self.x = self.y = None
