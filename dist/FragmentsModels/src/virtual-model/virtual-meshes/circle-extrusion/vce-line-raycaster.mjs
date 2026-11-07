import * as THREE from "three";
import { VceCasterUtils } from "./vce-caster-utils.mjs";
import { CircleExtrusion } from "../../../../../Schema/circle-extrusion.mjs";
import { Axis } from "../../../../../Schema/axis.mjs";
class VceLineRaycaster {
  _meshes;
  _found = [];
  _circleExtrusion = new CircleExtrusion();
  _axis = new Axis();
  _wirePoint = new THREE.Vector3();
  constructor(meshes) {
    this._meshes = meshes;
  }
  lineRaycast(id, ray) {
    this._found.length = 0;
    this._meshes.circleExtrusions(id, this._circleExtrusion);
    const count = this._circleExtrusion.axesLength();
    for (let index = 0; index < count; index++) {
      this._circleExtrusion.axes(index, this._axis);
      this.processLineRaycast(index, ray);
    }
    return this._found;
  }
  wireSetRaycast(ray, radius) {
    const axis = this._axis;
    VceCasterUtils.traverseWireSets(
      axis,
      (start, end) => {
        this.cylinderRaycast(start, end, ray, radius);
      }
    );
  }
  exclusiveCylinderRaycast(ray, radius) {
    const axis = this._axis;
    const event = this.getCylinderRaycastEvent(ray, radius);
    VceCasterUtils.traverseWires(axis, event);
  }
  processLineRaycast(id, ray) {
    const width = this._circleExtrusion.radius(id);
    this.exclusiveCylinderRaycast(ray, width);
    this.circleCurveRaycast(ray, width);
    this.wireSetRaycast(ray, width);
  }
  getCylinderRaycastEvent(ray, radius) {
    return (start, end) => {
      this.cylinderRaycast(start, end, ray, radius);
    };
  }
  processCircleCurveBody(body, ray, radius) {
    for (let i = 0; i < body.length; i++) {
      if (i === 0) continue;
      const mid = body[i];
      const past = body[i - 1];
      this.cylinderRaycast(past, mid, ray, radius);
    }
  }
  getCircleCurveRaycastEvent(ray, radius) {
    return (first, body, last) => {
      this.cylinderRaycast(first, body[0], ray, radius);
      this.processCircleCurveBody(body, ray, radius);
      const nextToLast = body[body.length - 1];
      this.cylinderRaycast(nextToLast, last, ray, radius);
    };
  }
  fetchCylinderRaycastResult(ray, first, last) {
    ray.distanceSqToSegment(first, last, void 0, this._wirePoint);
    const resultData = this.newResult(first, last);
    this._found.push(resultData);
  }
  circleCurveRaycast(ray, radius) {
    const divisionLogic = VceCasterUtils.circleCurve3Divisions;
    const event = this.getCircleCurveRaycastEvent(ray, radius);
    VceCasterUtils.traverseCircleCurve(this._axis, event, divisionLogic);
  }
  newResult(first, last) {
    return {
      point: this._wirePoint.clone(),
      raySquaredDistance: void 0,
      snappedEdgeP1: first.clone(),
      snappedEdgeP2: last.clone()
    };
  }
  cylinderRaycast(first, last, ray, radius) {
    const u = VceCasterUtils;
    const results = u.raycastCircleExtr(first, last, ray, radius);
    for (const result of results) {
      if (!result.point) continue;
      this.fetchCylinderRaycastResult(ray, first, last);
    }
  }
}
export {
  VceLineRaycaster
};
//# sourceMappingURL=vce-line-raycaster.mjs.map
