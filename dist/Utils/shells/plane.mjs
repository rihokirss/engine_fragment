import * as THREE from "three";
import { GeomsFbUtils } from "./index.mjs";
class Plane {
  normal;
  constant;
  id;
  faces = [];
  constructor(plane, precision, normalPrecision) {
    const nx = GeomsFbUtils.round(plane.normal.x, normalPrecision);
    const ny = GeomsFbUtils.round(plane.normal.y, normalPrecision);
    const nz = GeomsFbUtils.round(plane.normal.z, normalPrecision);
    const c = GeomsFbUtils.round(plane.constant, precision);
    this.normal = new THREE.Vector3(nx, ny, nz);
    this.constant = c;
    const planeSeparator = "||";
    this.id = `${nx}${planeSeparator}${ny}${planeSeparator}${nz}${planeSeparator}${c}`;
  }
}
export {
  Plane
};
//# sourceMappingURL=plane.mjs.map
