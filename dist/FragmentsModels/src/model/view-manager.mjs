import * as THREE from "three";
import { MultiThreadingRequestClass } from "./model-types.mjs";
import { GPU } from "../utils/misc/gpu.mjs";
import { CameraUtils } from "../utils/geometry/camera-utils.mjs";
class ViewManager {
  /**
   * Returns the planes to clip against. Read on every view refresh, so it
   * may return an array that the caller mutates in place.
   */
  getClippingPlanesEvent = () => [];
  currentCamera = null;
  _noCameraWarned = false;
  _tempMatrix = new THREE.Matrix4();
  _tempVec = new THREE.Vector3();
  _tempFrustum = new THREE.Frustum();
  /**
   * Numeric fingerprint of the last view dispatched to the worker.
   * `refreshView` skips the REFRESH_VIEW RPC when the view is
   * identical to the previous one (unless forced), so an idle camera
   * produces zero worker traffic instead of a full re-cull of every
   * sample on every update tick. See {@link refreshView}.
   */
  _lastViewSignature = null;
  _updateCameraPositionEvent = () => {
  };
  _updateCameraFrustumEvent = () => {
  };
  _updateFOVEvent = () => {
  };
  _updateOrthoSizeEvent = () => {
  };
  /**
   * Sends the current view to the worker so it can re-evaluate culling
   * and LOD. Returns `true` if a REFRESH_VIEW was actually dispatched.
   *
   * When `force` is false and the view (camera frustum + position in
   * model space, clipping planes, viewport size, quality, model
   * placement) is unchanged since the last dispatch, the RPC is
   * skipped entirely and `false` is returned. Visibility, highlight,
   * LOD-mode and edit changes don't need a view resend — the worker
   * restarts its own tile pass for those. Forced sends always go
   * through because `FragmentsModels.update(true)` uses the resulting
   * FINISH as a completion fence.
   */
  async refreshView(model, meshes, force = false) {
    const fov = this.setup(model);
    let frustum;
    if (!this.currentCamera) {
      this.warnNoCameraOnce(model);
      const bounds = model.box;
      if (!bounds.isEmpty()) {
        bounds.applyMatrix4(this._tempMatrix);
      }
      frustum = CameraUtils.containing(bounds, this._tempFrustum);
    } else {
      frustum = CameraUtils.transform(this._tempFrustum, this._tempMatrix);
    }
    const request = this.newViewRequest(frustum, fov, model);
    const signature = this.computeViewSignature(request.view, model);
    if (!force && this.signatureEquals(signature)) {
      return false;
    }
    this._lastViewSignature = signature;
    meshes.requests.clean(model.modelId);
    const sent = model.threads.fetch(request);
    meshes.viewDispatched(model.modelId, request.seq);
    await sent;
    return true;
  }
  useCamera(camera) {
    const projScreenMatrix = new THREE.Matrix4();
    this.setCameraPosition(camera);
    this.setCameraFrustum(camera, projScreenMatrix);
    this.setFov(camera);
    this.setOrtho();
    this.currentCamera = camera;
  }
  async setLodMode(model, lodMode) {
    return model._invoke("setLodMode", [lodMode]);
  }
  getOrthoSize() {
    let orthoSize = this._updateOrthoSizeEvent();
    if (orthoSize) {
      const modelScale = this._tempMatrix.getMaxScaleOnAxis();
      orthoSize *= modelScale;
    }
    return orthoSize;
  }
  setup(model) {
    this._tempMatrix.copy(model.object.matrixWorld).invert();
    this._updateCameraPositionEvent(this._tempVec);
    this._updateCameraFrustumEvent(this._tempFrustum);
    const fov = this._updateFOVEvent();
    return fov;
  }
  warnNoCameraOnce(model) {
    if (this._noCameraWarned) {
      return;
    }
    console.warn(
      `Fragments: model "${model.modelId}" is being rendered before useCamera() has been called. Frustum culling is disabled until a camera is set.`
    );
    this._noCameraWarned = true;
  }
  /**
   * Flattens everything view-relevant into a number list for cheap
   * equality checks. `graphicThreshold` is deliberately excluded: it
   * only budgets the worker's invisible-tile cache, so a change in it
   * (e.g. the worker count changed) shouldn't force a full re-cull.
   * `undefined` fields (fov on ortho cameras, ortho size on
   * perspective ones) are encoded as NaN and compared with
   * `Object.is` semantics below.
   */
  computeViewSignature(view, model) {
    const signature = [];
    const frustum = view.cameraFrustum;
    for (const plane of frustum.planes) {
      signature.push(plane.normal.x, plane.normal.y, plane.normal.z);
      signature.push(plane.constant);
    }
    const position = view.cameraPosition;
    signature.push(position.x, position.y, position.z);
    signature.push(view.fov ?? NaN);
    signature.push(view.orthogonalDimension ?? NaN);
    signature.push(view.viewSize);
    signature.push(view.graphicQuality);
    for (const plane of view.clippingPlanes) {
      signature.push(plane.normal.x, plane.normal.y, plane.normal.z);
      signature.push(plane.constant);
    }
    for (const element of model.object.matrixWorld.elements) {
      signature.push(element);
    }
    return signature;
  }
  signatureEquals(signature) {
    const last = this._lastViewSignature;
    if (!last || last.length !== signature.length) {
      return false;
    }
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== last[i] && !(Number.isNaN(signature[i]) && Number.isNaN(last[i]))) {
        return false;
      }
    }
    return true;
  }
  newViewRequest(frustum, fov, model) {
    const view = this.newView(frustum, fov, model);
    const request = {};
    request.class = MultiThreadingRequestClass.REFRESH_VIEW;
    request.modelId = model.modelId;
    request.cameraFrustum = frustum;
    request.view = view;
    return request;
  }
  newView(frustum, fov, model) {
    const view = {};
    view.cameraFrustum = frustum;
    view.cameraPosition = this._tempVec.applyMatrix4(this._tempMatrix);
    view.fov = fov;
    view.orthogonalDimension = this.getOrthoSize();
    view.viewSize = Math.max(window.innerWidth, window.innerHeight);
    const threadCount = Math.max(1, model.threads.activeThreadCount);
    view.graphicThreshold = GPU.estimateCapacity() / threadCount;
    view.graphicQuality = model.graphicsQuality * -1.5 + 2;
    view.clippingPlanes = this.getPlanes();
    view.modelPlacement = model.object.matrixWorld;
    return view;
  }
  setOrtho() {
    this._updateOrthoSizeEvent = () => {
      return void 0;
    };
  }
  setFov(camera) {
    this._updateFOVEvent = () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        return camera.fov;
      }
      return void 0;
    };
  }
  getPlanes() {
    const planes = [];
    const originalPlanes = this.getClippingPlanesEvent() ?? [];
    for (const plane of originalPlanes) {
      const cloned = plane.clone();
      cloned.applyMatrix4(this._tempMatrix);
      planes.push(cloned);
    }
    return planes;
  }
  setCameraPosition(camera) {
    this._updateCameraPositionEvent = (position) => {
      position.copy(camera.position);
    };
  }
  setCameraFrustum(camera, projScreenMatrix) {
    this._updateCameraFrustumEvent = (frustum) => {
      camera.updateProjectionMatrix();
      camera.updateWorldMatrix(true, true);
      const { projectionMatrix, matrixWorldInverse } = camera;
      projScreenMatrix.multiplyMatrices(projectionMatrix, matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
    };
  }
}
export {
  ViewManager
};
//# sourceMappingURL=view-manager.mjs.map
