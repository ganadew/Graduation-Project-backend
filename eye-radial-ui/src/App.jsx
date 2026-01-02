import { useState } from "react";
import RadialMenu from "./RadialMenu";
import Calibration from "./Calibration";
import CameraView from "./CameraView";
import GazeCursor from "./GazeCursor";
import "./App.css";

function App() {
  const [showCalibration, setShowCalibration] = useState(true);

  const handleCalibrationComplete = () => {
    setShowCalibration(false);
  };

  return (
    <div className="app-root">
      {showCalibration ? (
        <>
          <Calibration onComplete={handleCalibrationComplete} />
          {/* 시선 추적용 아이마우스 커서 */}
          <GazeCursor />
        </>
      ) : (
        <>
          <div className="app-camera-area">
            <CameraView />
          </div>
          <div className="app-radial-area">
            <RadialMenu />
          </div>
          {/* 시선(현재는 마우스) 추적용 커서 */}
          <GazeCursor />
        </>
      )}
    </div>
  );
}

export default App;