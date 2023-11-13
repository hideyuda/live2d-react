import { useCallback, useEffect, useRef } from "react";
import "./App.css";
import {
  FaceMesh,
  FACEMESH_TESSELATION,
  NormalizedLandmarkList,
  Results as FaceResult,
} from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

export const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawResults = useCallback((points: NormalizedLandmarkList) => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!canvasElement || !videoElement || !points) return;
    canvasElement.width = videoElement.videoWidth ?? 500;
    canvasElement.height = videoElement.videoHeight ?? 300;
    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 用意したcanvasにトラッキングしたデータを表示
    drawConnectors(canvasCtx, points, FACEMESH_TESSELATION, {
      color: "#C0C0C070",
      lineWidth: 1,
    });
    if (points && points.length === 478) {
      drawLandmarks(canvasCtx, [points[468], points[468 + 5]], {
        color: "#ffe603",
        lineWidth: 2,
      });
    }
  }, []);

  // facemeshから結果が取れたときのコールバック関数
  const onResult = useCallback(
    (results: FaceResult) => {
      drawResults(results.multiFaceLandmarks[0]);
    },
    [drawResults]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      const facemesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      // facemeshのオプション（詳細はドキュメントを）
      facemesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      // facemeshの結果が取得できたときのコールバックを設定
      facemesh.onResults(onResult);

      const camera = new Camera(videoElement, {
        onFrame: async () => {
          // frameごとにWebカメラの映像をfacemeshのAPIに投げる
          await facemesh.send({ image: videoElement });
        },
        width: 1280,
        height: 720,
      });
      camera.start();
    }
  }, [onResult]);

  return (
    <div className="App">
      <video
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          // カメラの映像が違和感がないように反転
          transform: "ScaleX(-1)",
        }}
        ref={videoRef}
      />
      <canvas
        style={{
          top: 0,
          left: 0,
          position: "absolute",
          transform: "ScaleX(-1)",
        }}
        ref={canvasRef}
      />
    </div>
  );
};
