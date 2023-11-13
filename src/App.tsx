import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import {
  FaceMesh,
  FACEMESH_TESSELATION,
  NormalizedLandmarkList,
  Results as FaceResult,
} from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import axios from "axios";
import AppCubismUserModel from "./lib/CubismModel";
import { draw, live2dRender } from "./renderer";
import { Face } from "kalidokit";

const live2dModel = {
  moc3: `http://localhost:3000/hiyori_free_t08/hiyori_free_t08.moc3`,
  model3: `http://localhost:3000/hiyori_free_t08/hiyori_free_t08.model3.json`,
  physics3: `http://localhost:3000/hiyori_free_t08/hiyori_free_t08.physics3.json`,
  textures: [
    `http://localhost:3000/hiyori_free_t08/hiyori_free_t08.2048/texture_00.png`,
  ],
};

export const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mod, setMod] = useState<AppCubismUserModel | null>(null);
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);

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

  const animateLive2DModel = useCallback(
    (points: NormalizedLandmarkList) => {
      const videoElement = videoRef.current;
      if (!mod || !points) return;
      let riggedFace = Face.solve(points, {
        runtime: "mediapipe",
        video: videoElement,
      });

      let lastUpdateTime = Date.now();
      draw(avatarCanvasRef.current!, lastUpdateTime, mod, riggedFace, 0);
    },
    [mod]
  );

  // onResult内でanimateLive2DModelを呼び出すように修正
  const onResult = useCallback(
    (results: FaceResult) => {
      drawResults(results.multiFaceLandmarks[0]);
      animateLive2DModel(results.multiFaceLandmarks[0]);
    },
    [animateLive2DModel, drawResults]
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

  const load = useCallback(async () => {

    if (avatarCanvasRef.current!) {
      console.log("load");
      try {
        const [model, moc3, physics, ...textures] = await Promise.all([
          axios
            .get<ArrayBuffer>(live2dModel.model3, {
              responseType: "arraybuffer",
            })
            .then((res) => res.data),
          axios
            .get(live2dModel.moc3, { responseType: "arraybuffer" })
            .then((res) => res.data),
          axios
            .get(live2dModel.physics3, { responseType: "arraybuffer" })
            .then((res) => res.data),
          ...live2dModel.textures.map(async (texture) => {
            const res = await axios.get(texture, { responseType: "blob" });
            return res.data;
          }),
        ]);

        const mod = await live2dRender(
          avatarCanvasRef.current!,
          model,
          {
            moc3,
            physics,
            textures,
          },
          {
            autoBlink: true,
            x: 0,
            y: 0,
            scale: 4,
          }
        );
        setMod(mod);
      } catch (e) {
        console.error(e);
      }
    }
  }, [live2dModel]);

  useEffect(() => {
    load();
  }, [load]);

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
      <canvas
        ref={avatarCanvasRef}
        width={1200}
        height={720}
        style={{
          top: 0,
          left: 0,
          position: "absolute",
        }}
      />
    </div>
  );
};
