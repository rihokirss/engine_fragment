import * as THREE from "three";
class PlanesUtils {
  static tempPoint = new THREE.Vector3();
  static dimensions = ["x", "y", "z"];
  static containedInParallelPlanes(ps, point) {
    let result = true;
    for (const clipPlane of ps) {
      const distance = clipPlane.distanceToPoint(point);
      const isInFront = distance >= 0;
      result = result && isInFront;
    }
    return result;
  }
  static collides(box, ps, included) {
    for (const plane of ps) {
      const distance = this.getPointDistance(plane, included, box);
      if (distance < 0) {
        return false;
      }
    }
    return true;
  }
  static getPointDistance(plane, included, box) {
    const normal = plane.normal;
    for (const dim of this.dimensions) {
      const isPositive = normal[dim] >= 0;
      const isMax = isPositive !== included;
      if (isMax) {
        this.tempPoint[dim] = box.max[dim];
      } else {
        this.tempPoint[dim] = box.min[dim];
      }
    }
    return plane.distanceToPoint(this.tempPoint);
  }
}
export {
  PlanesUtils
};
//# sourceMappingURL=planes-utils.mjs.map
