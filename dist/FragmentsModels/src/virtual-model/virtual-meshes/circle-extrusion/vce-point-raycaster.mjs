import * as THREE from "three";
import { VceUtils } from "./vce-utils.mjs";
import { VceCasterUtils } from "./vce-caster-utils.mjs";
import { CircleExtrusion } from "../../../../../Schema/circle-extrusion.mjs";
import { Axis } from "../../../../../Schema/axis.mjs";
class VcePointRaycaster {
  _meshes;
  _results = [];
  _circleExtrusion = new CircleExtrusion();
  _axis = new Axis();
  _normal = new THREE.Vector3();
  _point = new THREE.Vector3();
  _plane = new THREE.Plane();
  constructor(meshes) {
    this._meshes = meshes;
  }
  pointRaycast(id, ray) {
    this._results.length = 0;
    this._meshes.circleExtrusions(id, this._circleExtrusion);
    this.traverseAllCircleExtrusions(ray);
    return this.getCleanResults();
  }
  fetchOrientation(p1, p2) {
    VceUtils.temp.vector.copy(p1);
    VceUtils.temp.vector.sub(p2);
    VceUtils.temp.vector.normalize();
    const rot = VceUtils.temp.rotation;
    rot.setFromUnitVectors(VceUtils.up, VceUtils.temp.vector);
  }
  getTraverseWiresEvent(ray, radius) {
    return (first, last) => {
      this.fetchOrientation(first, last);
      const result1 = this.raycastCutCircleExtrusion(first, ray, radius);
      const result2 = this.raycastCutCircleExtrusion(last, ray, radius);
      this._results.push(result1, result2);
    };
  }
  traverseAllCircleExtrusions(ray) {
    const count = this._circleExtrusion.axesLength();
    for (let i = 0; i < count; i++) {
      this._circleExtrusion.axes(i, this._axis);
      const radius = this._circleExtrusion.radius(i);
      const count2 = VceUtils.vertexLength(radius);
      VceUtils.setPathVertices(count2);
      this.traverseAllCurves(ray, radius);
    }
  }
  setupCuttedCircleExtrusion(origin) {
    this._normal.set(0, 0, 1);
    this._normal.applyQuaternion(VceUtils.temp.rotation);
    this._plane.setFromNormalAndCoplanarPoint(this._normal, origin);
  }
  getTraverseCircleCurveEvent(ray, radius) {
    return (first, mids, last) => {
      this.fetchOrientation(first, mids[0]);
      const result1 = this.raycastCutCircleExtrusion(first, ray, radius);
      const nextToLast = mids[mids.length - 1];
      this.fetchOrientation(nextToLast, last);
      const result2 = this.raycastCutCircleExtrusion(last, ray, radius);
      this._results.push(result1, result2);
    };
  }
  computeCutCircleExtrCast(origin, radius, ray) {
    ray.intersectPlane(this._plane, this._point);
    const distance = this._point.distanceTo(origin);
    if (distance <= radius) {
      const point = origin.clone();
      return { point };
    }
    return void 0;
  }
  raycastCutCircleExtrusion(origin, ray, radius) {
    this.setupCuttedCircleExtrusion(origin);
    const collides = ray.intersectsPlane(this._plane);
    if (collides) {
      return this.computeCutCircleExtrCast(origin, radius, ray);
    }
    return void 0;
  }
  getCleanResults() {
    const filtered = [];
    for (const result of this._results) {
      if (result) {
        filtered.push(result);
      }
    }
    return filtered;
  }
  traverseAllCurves(ray, radius) {
    const wiresEvent = this.getTraverseWiresEvent(ray, radius);
    VceCasterUtils.traverseWires(this._axis, wiresEvent);
    const circleEvent = this.getTraverseCircleCurveEvent(ray, radius);
    const divider = VceCasterUtils.circleCurve3Divisions;
    VceCasterUtils.traverseCircleCurve(this._axis, circleEvent, divider);
    const wireSetsEvent = this.getTraverseWiresEvent(ray, radius);
    VceCasterUtils.traverseWireSets(this._axis, wireSetsEvent);
  }
}
export {
  VcePointRaycaster
};
//# sourceMappingURL=vce-point-raycaster.mjs.map
