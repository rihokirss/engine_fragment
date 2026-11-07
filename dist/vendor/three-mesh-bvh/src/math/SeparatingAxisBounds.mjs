import { Vector3 } from "three";
class SeparatingAxisBounds {
  constructor() {
    this.min = Infinity;
    this.max = -Infinity;
  }
  setFromPointsField(points, field) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = p[field];
      min = val < min ? val : min;
      max = val > max ? val : max;
    }
    this.min = min;
    this.max = max;
  }
  setFromPoints(axis, points) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = axis.dot(p);
      min = val < min ? val : min;
      max = val > max ? val : max;
    }
    this.min = min;
    this.max = max;
  }
  isSeparated(other) {
    return this.min > other.max || other.min > this.max;
  }
}
SeparatingAxisBounds.prototype.setFromBox = /* @__PURE__ */ (function() {
  const p = /* @__PURE__ */ new Vector3();
  return function setFromBox(axis, box) {
    const boxMin = box.min;
    const boxMax = box.max;
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          p.x = boxMin.x * x + boxMax.x * (1 - x);
          p.y = boxMin.y * y + boxMax.y * (1 - y);
          p.z = boxMin.z * z + boxMax.z * (1 - z);
          const val = axis.dot(p);
          min = Math.min(val, min);
          max = Math.max(val, max);
        }
      }
    }
    this.min = min;
    this.max = max;
  };
})();
export {
  SeparatingAxisBounds
};
//# sourceMappingURL=SeparatingAxisBounds.mjs.map
