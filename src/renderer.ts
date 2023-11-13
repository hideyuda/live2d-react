import { Face, TFace, Vector } from "kalidokit";
import AppCubismUserModel from "./lib/CubismModel";

import {
  CubismFramework,
  CubismMatrix44,
  CubismModelSettingJson,
  ICubismModelSetting,
} from "./lib/Live2dSDK";
import { params } from "./params";

export interface AvatarArrayBuffers {
  moc3: ArrayBuffer;
  textures: Blob[];
  physics: ArrayBuffer;
}
interface Live2dRendererOption {
  autoBlink: boolean;
  x: number;
  y: number;
  scale: number;
}
const DEFAULT_OPTION: Live2dRendererOption = {
  autoBlink: true,
  x: 0,
  y: 0,
  scale: 1,
};
export async function live2dRender(
  canvas: HTMLCanvasElement,
  _model: ArrayBuffer,
  buffers: AvatarArrayBuffers,
  options: Partial<Live2dRendererOption> = {}
) {
  const gl = canvas.getContext("webgl");
  if (gl === null) throw new Error("WebGL未対応のブラウザです。");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  const option = Object.assign({}, DEFAULT_OPTION, options);

  const frameBuffer: WebGLFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

  CubismFramework.startUp();
  CubismFramework.initialize();
  const defaultPosition = Object.assign(
    {
      x: 0,
      y: 0,
      z: 0.2,
    },
    {
      x: option.x,
      y: option.y,
      z: option.scale,
    }
  );

  const modelSetting = new CubismModelSettingJson(
    _model,
    _model.byteLength
  ) as ICubismModelSetting;

  const {
    moc3: moc3ArrayBuffer,
    textures,
    physics: physics3ArrayBuffer,
  } = buffers;

  const model = new AppCubismUserModel();
  model.loadModel(moc3ArrayBuffer);
  model.createRenderer();
  let i = 0;
  for (let buffer of textures) {
    const texture = await createTexture(buffer, gl);
    model.getRenderer().bindTexture(i, texture);
    i++;
  }
  model.getRenderer().setIsPremultipliedAlpha(true);
  model.getRenderer().startUp(gl);

  for (
    let i = 0, len = modelSetting.getEyeBlinkParameterCount();
    i < len;
    i++
  ) {
    model.addEyeBlinkParameterId(modelSetting.getEyeBlinkParameterId(i));
  }
  for (let i = 0, len = modelSetting.getLipSyncParameterCount(); i < len; i++) {
    model.addLipSyncParameterId(modelSetting.getLipSyncParameterId(i));
  }
  model.loadPhysics(physics3ArrayBuffer, physics3ArrayBuffer.byteLength);

  const projectionMatrix = new CubismMatrix44();
  const resizeModel = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const modelMatrix = model.getModelMatrix();
    modelMatrix.bottom(0);
    modelMatrix.centerY(-1);
    modelMatrix.translateY(-1);
    projectionMatrix.loadIdentity();
    const canvasRatio = canvas.height / canvas.width;
    if (1 < canvasRatio) {
      modelMatrix.scale(1, canvas.width / canvas.height);
    } else {
      modelMatrix.scale(canvas.height / canvas.width, 1);
    }
    modelMatrix.translateRelative(defaultPosition.x, defaultPosition.y);

    projectionMatrix.multiplyByMatrix(modelMatrix);
    const scale = 2;
    projectionMatrix.scaleRelative(scale, scale);
    projectionMatrix.translateY(-0.6);
    model.getRenderer().setMvpMatrix(projectionMatrix);
  };
  resizeModel();

  const viewport: number[] = [0, 0, canvas.width, canvas.height];

  viewport[2] = canvas.width;
  viewport[3] = canvas.height;
  model.getRenderer().setRenderState(frameBuffer, viewport);

  model.getRenderer().drawModel();

  window.onresize = () => {
    resizeModel();
  };
  return model;
}


/**
 * テクスチャを生成する
 * @param path テクスチャのパス
 * @param gl WebGLコンテキスト
 */
async function createTexture(
  blob: Blob,
  gl: WebGLRenderingContext
): Promise<WebGLTexture> {
  return new Promise((resolve: (texture: WebGLTexture) => void) => {
    const url = URL.createObjectURL(blob);
    const img: HTMLImageElement = new Image();
    img.onload = () => {
      const tex: WebGLTexture = gl.createTexture() as WebGLTexture;

      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      gl.generateMipmap(gl.TEXTURE_2D);
      URL.revokeObjectURL(url);
      return resolve(tex);
    };
    img.addEventListener("error", () => {
      console.error(`image load error`);
    });
    img.src = url;
  });
}

export const draw = (
  canvas: HTMLCanvasElement,
  lastUpdateTime: number,
  model: AppCubismUserModel,
  faceRig: TFace | undefined,
  type: 0 = 0
) => {
  const gl = canvas.getContext("webgl");
  if (gl === null) throw new Error("WebGL未対応のブラウザです。");
  const frameBuffer: WebGLFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  const viewport: number[] = [0, 0, canvas.width, canvas.height];
  const time = Date.now();
  const deltaTimeSecond = (time - lastUpdateTime) / 1000;

  const _model = model.getModel();
  const idManager = CubismFramework.getIdManager();

  const lerpAmount = 0.7;
  if (faceRig) {
    _model.setParameterValueById(
      idManager.getId(params.angleX[type]),
      Vector.lerp(
        faceRig.head.degrees.y,
        _model.getParameterValueById(idManager.getId(params.angleX[type])),
        lerpAmount
      )
    );
    _model.setParameterValueById(
      idManager.getId(params.angleY[type]),
      Vector.lerp(
        faceRig.head.degrees.x,
        _model.getParameterValueById(idManager.getId(params.angleY[type])),
        lerpAmount
      )
    );

    _model.setParameterValueById(
      idManager.getId(params.angleZ[type]),
      Vector.lerp(
        faceRig.head.degrees.z,
        _model.getParameterValueById(idManager.getId(params.angleZ[type])),
        lerpAmount
      )
    );

    _model.setParameterValueById(
      idManager.getId(params.eyeBallX[type]),
      Vector.lerp(
        faceRig.pupil.x,
        _model.getParameterValueById(idManager.getId(params.eyeBallX[type])),
        lerpAmount
      )
    );
    _model.setParameterValueById(
      idManager.getId(params.eyeBallY[type]),
      Vector.lerp(
        faceRig.pupil.y,
        _model.getParameterValueById(idManager.getId(params.eyeBallY[type])),
        lerpAmount
      )
    );

    const dampener = 0.3;
    _model.setParameterValueById(
      idManager.getId(params.bodyAngleX[type]),
      Vector.lerp(
        faceRig.head.degrees.y * dampener,
        _model.getParameterValueById(idManager.getId(params.bodyAngleX[type])),
        lerpAmount
      )
    );
    _model.setParameterValueById(
      idManager.getId(params.bodyAngleY[type]),
      Vector.lerp(
        faceRig.head.degrees.x * dampener,
        _model.getParameterValueById(idManager.getId(params.bodyAngleY[type])),
        lerpAmount
      )
    );
    _model.setParameterValueById(
      idManager.getId(params.bodyAngleZ[type]),
      Vector.lerp(
        faceRig.head.degrees.z * dampener,
        _model.getParameterValueById(idManager.getId(params.bodyAngleZ[type])),
        lerpAmount
      )
    );

    let stabilizedEyes = Face.stabilizeBlink(
      {
        l: Vector.lerp(
          faceRig.eye.l,
          _model.getParameterValueById(idManager.getId(params.eyeLOpen[type])),
          0.7
        ),
        r: Vector.lerp(
          faceRig.eye.r,
          _model.getParameterValueById(idManager.getId(params.eyeROpen[type])),
          0.7
        ),
      },
      faceRig.head.y
    );

    _model.setParameterValueById(
      idManager.getId(params.eyeLOpen[type]),
      stabilizedEyes.l
    );
    _model.setParameterValueById(
      idManager.getId(params.eyeROpen[type]),
      stabilizedEyes.r
    );
    _model.setParameterValueById(
      idManager.getId(params.mouthOpen[type]),
      Vector.lerp(
        faceRig.mouth.y,
        _model.getParameterValueById(idManager.getId(params.mouthOpen[type])),
        0.3
      )
    );
    _model.setParameterValueById(
      idManager.getId(params.mouthForm[type]),
      0.3 +
        Vector.lerp(
          faceRig.mouth.x,
          _model.getParameterValueById(idManager.getId(params.mouthForm[type])),
          0.3
        )
    );
  }

  _model.saveParameters();
  // // 頂点の更新
  model.update(deltaTimeSecond);

  if (model.isMotionFinished) {
    const idx = Math.floor(Math.random() * model.motionNames.length);
    const name = model.motionNames[idx];
    model.startMotionByName(name);
  }

  viewport[2] = canvas.width;
  viewport[3] = canvas.height;
  model.getRenderer().setRenderState(frameBuffer, viewport);

  // モデルの描画
  model.getRenderer().drawModel();

  lastUpdateTime = time;
};
