export function correctHeadPose(rawGaze, landmarks) {
  if (!rawGaze || !landmarks) return rawGaze

  // MediaPipe FaceMesh 주요 인덱스 (refineLandmarks true 기준에서도 안전)
  const leftEyeOuter = landmarks[33]
  const rightEyeOuter = landmarks[263]
  const noseTip = landmarks[1]

  if (!leftEyeOuter || !rightEyeOuter || !noseTip) return rawGaze

  const eyeCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2
  const eyeCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2

  // yaw/pitch 오프셋(정규화 좌표 기준 -0.5~0.5 정도 값)
  const yaw = noseTip.x - eyeCenterX
  const pitch = noseTip.y - eyeCenterY

  // 보정 강도(너무 크면 오히려 흔들림 커짐 → 실사용에서 250~450 사이 추천)
  const K = 350

  return {
    x: rawGaze.x - yaw * K,
    y: rawGaze.y - pitch * K,
  }
}
