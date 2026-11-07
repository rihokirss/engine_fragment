import * as THREE from "three";
import { MultiThreadingRequestClass } from "./model-types.mjs";
import { CameraUtils } from "../utils/geometry/camera-utils.mjs";
class RaycastManager {
  _caster = new THREE.Raycaster();
  _ray = new THREE.Ray();
  _frustum = new THREE.Frustum();
  _inverseTransform = new THREE.Matrix4();
  _t = new THREE.Plane();
  _r = new THREE.Plane();
  _b = new THREE.Plane();
  _l = new THREE.Plane();
  _n = new THREE.Plane();
  _f = new THREE.Plane();
  _tl = new THREE.Vector3();
  _tr = new THREE.Vector3();
  _bl = new THREE.Vector3();
  _br = new THREE.Vector3();
  _tln = new THREE.Vector3();
  _brn = new THREE.Vector3();
  _tlp = new THREE.Vector2();
  _brp = new THREE.Vector2();
  distance = 10;
  async raycast(model, data) {
    const { frustum, ray } = this.getRayAndFrustum(data);
    const request = this.getRequest(model, frustum, ray);
    if (!request) return null;
    const response = await model.threads.fetch(request);
    if (response.results && response.results.length) {
      const [firstHit] = response.results;
      return this.getResult({
        hit: firstHit,
        frustum,
        ray,
        model
      });
    }
    return null;
  }
  async raycastAll(model, data) {
    const { frustum, ray } = this.getRayAndFrustum(data);
    const request = this.getRequest(model, frustum, ray);
    if (!request) return null;
    request.returnAll = true;
    const allResults = [];
    const response = await model.threads.fetch(request);
    if (response.results && response.results.length) {
      for (const hit of response.results) {
        allResults.push(
          this.getResult({
            hit,
            frustum,
            ray,
            model
          })
        );
      }
      return allResults;
    }
    return null;
  }
  async rectangleRaycast(model, meshes, data) {
    const frustum = this.getFrustum(data);
    const request = this.getRequest(model, frustum);
    if (!request) return null;
    request.fullyIncluded = data.fullyIncluded;
    const response = await model.threads.fetch(request);
    if (response.localIds && response.localIds.length) {
      return this.newRectangleCastResponse(response, meshes);
    }
    return null;
  }
  async raycastWithSnapping(model, data) {
    const { frustum, ray } = this.getRayAndFrustum(data);
    const request = this.getRequest(model, frustum, ray);
    if (!request) return null;
    request.snappingClass = data.snappingClasses;
    const response = await model.threads.fetch(request);
    if (response.results) {
      return this.newRaycastSnapResult(response, frustum, ray, model);
    }
    return null;
  }
  screenRectToFrustum(screenTopLeft, screenBottomRight, container, camera) {
    this.screenToCast(screenTopLeft, container, this._tlp);
    this.screenToCast(screenBottomRight, container, this._brp);
    this.setVectors(camera);
    this.setPlanes(camera);
    return this.newFrustum();
  }
  screenToCasterPoint(point, viewer, camera) {
    const casterPoint = this.screenToCast(point, viewer);
    this._caster.setFromCamera(casterPoint, camera);
    return this._caster.ray.clone();
  }
  setPlanes(camera) {
    this.setBasePoints();
    camera.getWorldDirection(this._n.normal);
    this.setEnds(camera);
  }
  setVectors(camera) {
    this.setVector(this._tl, this._tlp, this._tlp, 1, camera);
    this.setVector(this._tr, this._brp, this._tlp, 1, camera);
    this.setVector(this._bl, this._tlp, this._brp, 1, camera);
    this.setVector(this._br, this._brp, this._brp, 1, camera);
    this.setVector(this._tln, this._tlp, this._tlp, 0, camera);
    this.setVector(this._brn, this._brp, this._brp, 0, camera);
  }
  newFrustum() {
    return new THREE.Frustum(
      this._t,
      this._b,
      this._l,
      this._r,
      this._f,
      this._n
    );
  }
  setEnds(camera) {
    if (camera instanceof THREE.OrthographicCamera) {
      const camPos = camera.position;
      const normalDotPos = this._n.normal.dot(camPos);
      this._n.constant = -(normalDotPos + camera.near);
      this._f.constant = -(normalDotPos - camera.far);
    } else {
      this._n.constant = camera.position.length();
      this._f.constant = Infinity;
    }
    this._f.normal = this._n.normal;
  }
  screenToCast(p, element, result = new THREE.Vector2()) {
    const rect = element.getBoundingClientRect();
    const scaleX = rect.width / element.clientWidth;
    const scaleY = rect.height / element.clientHeight;
    const x = (p.x - rect.left) / scaleX;
    const y = (p.y - rect.top) / scaleY;
    result.x = x / element.clientWidth * 2 - 1;
    result.y = -(y / element.clientHeight) * 2 + 1;
    return result;
  }
  setVector(v1, v2, v3, value, camera) {
    v1.set(v2.x, v3.y, value);
    v1.unproject(camera);
  }
  setPlane(plane, v1, v2, v3) {
    plane.setFromCoplanarPoints(v1, v2, v3);
  }
  setBasePoints() {
    this.setPlane(this._t, this._tln, this._tl, this._tr);
    this.setPlane(this._r, this._brn, this._tr, this._br);
    this.setPlane(this._b, this._brn, this._br, this._bl);
    this.setPlane(this._l, this._tln, this._bl, this._tl);
  }
  setupRay(ray, message) {
    if (ray) {
      this._ray.copy(ray);
      this._ray.applyMatrix4(this._inverseTransform);
      message.ray = this._ray;
    }
  }
  setupMatrix(object) {
    this._inverseTransform.copy(object.matrixWorld);
    this._inverseTransform.invert();
  }
  getRequest(model, frustum, ray) {
    const { object, box, modelId } = model;
    const collidesModel = frustum.intersectsBox(box);
    if (collidesModel) {
      return this.newCastRequest(object, modelId, ray, frustum);
    }
    return null;
  }
  getRayAndFrustum(data) {
    this.updateCamera(data.camera);
    const { bottomLeft, topRight } = this.getCorners(data.mouse);
    const ray = this.screenToCasterPoint(data.mouse, data.dom, data.camera);
    const frustum = this.screenRectToFrustum(
      bottomLeft,
      topRight,
      data.dom,
      data.camera
    );
    return { ray, frustum };
  }
  getFrustum(data) {
    this.updateCamera(data.camera);
    return this.screenRectToFrustum(
      data.topLeft,
      data.bottomRight,
      data.dom,
      data.camera
    );
  }
  getCorners(mouse) {
    const bottomLeft = mouse.clone().subScalar(this.distance);
    const topRight = mouse.clone().addScalar(this.distance);
    return { bottomLeft, topRight };
  }
  getResult(data) {
    const { hit, frustum, ray, model } = data;
    const result = {};
    this.setPoint(model, hit, result);
    this.setNormal(model, hit, result);
    this.setDistance(model, hit, result);
    this.setRayDistance(model, hit, result);
    this.setBasicHitData(model, hit, result, ray, frustum);
    this.setSnapEdge(model, hit, result, "snappedEdgeP1");
    this.setSnapEdge(model, hit, result, "snappedEdgeP2");
    result.facePoints = hit.facePoints;
    result.faceIndices = hit.faceIndices;
    return result;
  }
  updateCamera(camera) {
    camera.updateProjectionMatrix();
    camera.updateWorldMatrix(true, true);
  }
  newCastRequest(object, modelId, ray, frustum) {
    this.setupMatrix(object);
    const request = {};
    request.class = MultiThreadingRequestClass.RAYCAST;
    request.modelId = modelId;
    this.setupRay(ray, request);
    CameraUtils.transform(frustum, this._inverseTransform, this._frustum);
    request.frustum = this._frustum;
    return request;
  }
  setSnapEdge(model, hit, result, key) {
    if (hit[key]) {
      const edge = new THREE.Vector3();
      edge.copy(hit[key]);
      edge.applyMatrix4(model.object.matrixWorld);
      result[key] = edge;
    } else {
      result[key] = void 0;
    }
  }
  setNormal(model, hit, result) {
    if (hit.normal) {
      const normal = new THREE.Vector3();
      normal.copy(hit.normal);
      normal.transformDirection(model.object.matrixWorld);
      normal.normalize();
      result.normal = normal;
      return;
    }
    result.normal = void 0;
  }
  setDistance(model, hit, result) {
    const cameraDist = Math.sqrt(hit.cameraSquaredDistance);
    const modelScale = model.object.matrixWorld.getMaxScaleOnAxis();
    result.distance = cameraDist * modelScale;
  }
  setPoint(model, hit, result) {
    const point = new THREE.Vector3();
    point.copy(hit.point);
    point.applyMatrix4(model.object.matrixWorld);
    result.point = point;
  }
  newRaycastSnapResult(response, frustum, ray, model) {
    const results = [];
    for (const hit of response.results) {
      const result = this.getResult({ hit, frustum, ray, model });
      results.push(result);
    }
    return results;
  }
  newRectangleCastResponse(response, meshes) {
    const result = {
      localIds: response.localIds,
      fragments: meshes.list.get(response.modelId)
    };
    return result;
  }
  setRayDistance(model, hit, result) {
    if (hit.raySquaredDistance !== void 0) {
      const modelScale = model.object.matrixWorld.getMaxScaleOnAxis();
      const rayDist = Math.sqrt(hit.raySquaredDistance);
      result.rayDistance = rayDist * modelScale;
      return;
    }
    result.rayDistance = void 0;
  }
  setBasicHitData(model, hit, result, ray, frustum) {
    result.itemId = hit.itemId;
    result.localId = hit.localId;
    result.object = model.object;
    result.fragments = model;
    result.ray = ray;
    result.frustum = frustum;
    result.representationClass = hit.representationClass;
    result.snappingClass = hit.snappingClass;
  }
}
export {
  RaycastManager
};
//# sourceMappingURL=raycast-manager.mjs.map
