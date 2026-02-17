import React, { useEffect, useMemo, useRef, useState } from "react"
import Spline from "@splinetool/react-spline"
import * as THREE from "three"
import DwellEngine from "../utils/dwellEngine"
import GazeFilter from "../utils/gazeFilter"
import { correctHeadPose } from "../utils/headPoseCorrection"

/**
 * props
 * - gaze: {x,y}
 * - landmarks: mediapipe landmarks array
 * - onComplete: () => void
 */
export default function GameCalibration3D({ gaze, landmarks, onComplete }) {
  const splineRef = useRef(null)

  // 내부 three 접근용(비공식 접근. Spline 내부 구현이 바뀌면 수정 필요할 수 있음)
  const threeSceneRef = useRef(null)
  const threeCameraRef = useRef(null)
  const canvasRectRef = useRef(null)

  const robotRef = useRef(null)
  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())

  const dwell = useRef(new DwellEngine(1500))
  const filter = useRef(new GazeFilter(0.22))

  const [targets, setTargets] = useState([]) // THREE.Object3D[]
  const [idx, setIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  // 별(메모리 누수 방지: 너무 많이 쌓이면 정리)
  const spawnedStars = useRef([])

  const TOTAL = 30

  // ---- 유틸: canvas 좌표계를 기준으로 gaze를 NDC(-1~1)로 변환
  const gazeToNDC = (gx, gy) => {
    const rect = canvasRectRef.current
    if (!rect) return null

    const x = (gx - rect.left) / rect.width
    const y = (gy - rect.top) / rect.height

    // 화면 밖이면 무시
    if (x < 0 || x > 1 || y < 0 || y > 1) return null

    return { x: x * 2 - 1, y: -(y * 2 - 1) }
  }

  // ---- 유틸: 3D 포인트를 화면 좌표로 투영해서 webgazer 학습용 (screenX, screenY) 만들기
  const worldToScreen = (worldPoint) => {
    const camera = threeCameraRef.current
    const rect = canvasRectRef.current
    if (!camera || !rect) return null

    const p = worldPoint.clone().project(camera) // NDC
    const sx = (p.x + 1) / 2 * rect.width + rect.left
    const sy = (1 - (p.y + 1) / 2) * rect.height + rect.top
    return { x: sx, y: sy }
  }

  // ---- 유틸: 타겟 하이라이트(현재 타겟만 살짝 빛나게)
  const setTargetHighlight = (obj, on) => {
    if (!obj) return
    obj.traverse((child) => {
      if (child.isMesh && child.material) {
        // emissive가 있는 material만 적용
        if ("emissive" in child.material) {
          child.material.emissiveIntensity = on ? 0.9 : 0.0
        }
      }
    })
  }

  // ---- 유틸: 노란 별 생성
  const spawnStar = (point) => {
    const scene = threeSceneRef.current
    if (!scene) return

    const geo = new THREE.SphereGeometry(0.06, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffee33 })
    const star = new THREE.Mesh(geo, mat)
    star.position.copy(point)
    scene.add(star)

    spawnedStars.current.push(star)
    // 별이 너무 많아지면 오래된 것부터 제거
    if (spawnedStars.current.length > 60) {
      const old = spawnedStars.current.shift()
      if (old) scene.remove(old)
    }
  }

  // ---- 로봇 이동(부드럽게 lerp)
  const moveRobotToward = (worldPoint) => {
    const robot = robotRef.current
    if (!robot) return
    robot.position.lerp(worldPoint, 0.12)
  }

  // ---- Spline 로딩 완료 시: scene/camera/robot/targets 세팅
  const handleSplineLoad = (splineApp) => {
    splineRef.current = splineApp

    // Canvas rect 저장
    const canvas = document.querySelector("canvas")
    if (canvas) canvasRectRef.current = canvas.getBoundingClientRect()

    // 👇 비공식 접근(많이들 이렇게 씀)
    // Spline runtime 내부에 three scene/camera가 들어있음
    const maybeScene = splineApp?._scene || splineApp?.scene
    const maybeCamera =
      splineApp?._camera ||
      splineApp?.camera ||
      (maybeScene?.children || []).find((o) => o.isCamera)

    threeSceneRef.current = maybeScene || null
    threeCameraRef.current = maybeCamera || null

    // 로봇 찾기
    const robot =
      (splineApp.findObjectByName && splineApp.findObjectByName("GazeBot")) ||
      (maybeScene && maybeScene.getObjectByName && maybeScene.getObjectByName("GazeBot"))

    robotRef.current = robot || null

    // 타겟 후보 추출: Mesh 위주, 로봇 제외
    let meshes = []
    if (maybeScene?.traverse) {
      maybeScene.traverse((obj) => {
        if (obj.isMesh) {
          // 로봇이나 UI성 오브젝트 제외
          if (obj.name === "GazeBot") return
          if (obj.name?.toLowerCase().includes("camera")) return
          if (obj.name?.toLowerCase().includes("light")) return
          meshes.push(obj)
        }
      })
    }

    // 랜덤 30개 선택(중복 제거)
    meshes = Array.from(new Set(meshes))
    meshes.sort(() => Math.random() - 0.5)
    const selected = meshes.slice(0, TOTAL)

    setTargets(selected)
    setIdx(0)
    setProgress(0)

    // 첫 타겟 하이라이트
    if (selected[0]) setTargetHighlight(selected[0], true)
  }

  // canvas resize 시 rect 갱신
  useEffect(() => {
    const onResize = () => {
      const canvas = document.querySelector("canvas")
      if (canvas) canvasRectRef.current = canvas.getBoundingClientRect()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // ---- 매 프레임: gaze → 보정/스무딩 → raycast → dwell → 성공 처리
  useEffect(() => {
    if (!gaze) return
    const scene = threeSceneRef.current
    const camera = threeCameraRef.current
    if (!scene || !camera) return
    if (!targets.length) return
    if (idx >= targets.length) return

    const corrected = correctHeadPose(gaze, landmarks)
    const smooth = filter.current.smooth(corrected)
    if (!smooth) return

    // NDC 변환
    const ndcPoint = gazeToNDC(smooth.x, smooth.y)
    if (!ndcPoint) {
      setProgress(0)
      dwell.current.reset()
      return
    }

    ndc.current.set(ndcPoint.x, ndcPoint.y)
    raycaster.current.setFromCamera(ndc.current, camera)

    const activeTarget = targets[idx]
    const intersects = raycaster.current.intersectObject(activeTarget, true)

    if (intersects.length > 0) {
      const hitObj = intersects[0].object
      const { done, progress: p } = dwell.current.update(hitObj.uuid)
      setProgress(p)

      // 로봇은 “시선이 닿은 곳”을 향해 움직이게(매 프레임)
      moveRobotToward(intersects[0].point)

      if (done) {
        // ✅ 성공 처리: 별 생성
        spawnStar(intersects[0].point)

        // ✅ webgazer 학습: "타겟 오브젝트의 대표 위치"를 화면 좌표로 투영해서 기록
        // (중요) recordScreenPosition에는 "사용자가 봐야 하는 화면 좌표"를 넣는 게 좋음
        const targetWorld = new THREE.Vector3()
        activeTarget.getWorldPosition(targetWorld)
        const screen = worldToScreen(targetWorld)
        if (screen && window.webgazer?.recordScreenPosition) {
          window.webgazer.recordScreenPosition(screen.x, screen.y, "calib")
        }

        // 다음 타겟으로 넘어가기
        setTargetHighlight(activeTarget, false)
        dwell.current.reset()
        setProgress(0)

        const next = idx + 1
        setIdx(next)

        if (next < targets.length) {
          setTargetHighlight(targets[next], true)
        } else {
          // 끝!
          onComplete?.()
        }
      }
    } else {
      // 타겟을 안 보고 있으면 dwell 리셋(너무 빡세면 reset 대신 progress만 낮추는 방식도 가능)
      setProgress(0)
      dwell.current.reset()
    }
  }, [gaze, landmarks, targets, idx, onComplete])

  // ---- 화면에 진행률(원형 게이지) 표시(2D overlay)
  const percent = Math.round(progress * 100)
  const doneText = idx >= TOTAL ? "완료!" : `${idx + 1} / ${TOTAL}`

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Spline scene="/scene.splinecode" onLoad={handleSplineLoad} />

      {/* 진행 UI(간단하게) */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.45)",
          color: "white",
          fontSize: 14,
          lineHeight: 1.4,
          userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 700 }}>Calibration Game</div>
        <div>Target: {doneText}</div>
        <div>Dwell: {percent}%</div>
        <div style={{ opacity: 0.85, marginTop: 6 }}>
          별을 쳐다보면 로봇이 따라가요 ⭐
        </div>
      </div>

      {/* (선택) 현재 시선 점 디버그 표시하고 싶으면 이 div 활성화 */}
      {/* <div style={{ position:"absolute", left: (gaze?.x ?? 0)-6, top:(gaze?.y ?? 0)-6, width:12, height:12, borderRadius:"50%", background:"red" }} /> */}
    </div>
  )
}
