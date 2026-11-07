import { VceCasterUtils } from "./vce-caster-utils.mjs";
import { CircleExtrusion } from "../../../../../Schema/circle-extrusion.mjs";
import { Axis } from "../../../../../Schema/axis.mjs";
class VceRaycaster {
  _meshes;
  _results = [];
  _circleExtrusion = new CircleExtrusion();
  _axis = new Axis();
  constructor(meshes) {
    this._meshes = meshes;
  }
  raycast(id, ray) {
    this._results.length = 0;
    this._meshes.circleExtrusions(id, this._circleExtrusion);
    for (let i = 0, l = this._circleExtrusion.axesLength(); i < l; i++) {
      this._circleExtrusion.axes(i, this._axis);
      const radius = this._circleExtrusion.radius(i);
      this.traverseAllCurves(ray, radius);
    }
    return this._results;
  }
  getTraverseWiresEvent(ray, radius) {
    return (start, end) => {
      this.castCurveExtrusion(start, end, ray, radius);
    };
  }
  castCurveExtrusion(a, b, ray, radius) {
    const u = VceCasterUtils;
    const result1 = u.raycastCircleExtr(a, b, ray, radius);
    for (const result of result1) {
      this._results.push(result);
    }
  }
  getTraverseCircleCurveEvent(ray, radius) {
    return (first, mids, last) => {
      const second = mids[0];
      this.castCurveExtrusion(first, second, ray, radius);
      for (let i = 0; i < mids.length; i++) {
        if (i === 0) continue;
        const first2 = mids[i - 1];
        const second2 = mids[i];
        this.castCurveExtrusion(first2, second2, ray, radius);
      }
      const nextToLast = mids[mids.length - 1];
      this.castCurveExtrusion(nextToLast, last, ray, radius);
    };
  }
  traverseAllCurves(ray, radius) {
    const wireEvent = this.getTraverseWiresEvent(ray, radius);
    VceCasterUtils.traverseWires(this._axis, wireEvent);
    const circleCurveEvent = this.getTraverseCircleCurveEvent(ray, radius);
    const divider = VceCasterUtils.circleCurve3Divisions;
    VceCasterUtils.traverseCircleCurve(this._axis, circleCurveEvent, divider);
    const wireSetEvent = this.getTraverseWiresEvent(ray, radius);
    VceCasterUtils.traverseWireSets(this._axis, wireSetEvent);
  }
}
export {
  VceRaycaster
};
//# sourceMappingURL=vce-raycaster.mjs.map
