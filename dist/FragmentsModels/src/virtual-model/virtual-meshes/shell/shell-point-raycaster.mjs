import * as THREE from "three";
import { ShellUtils } from "./shell-utils.mjs";
class ShellPointRaycaster {
  _meshes;
  _tempVec = new THREE.Vector3();
  constructor(_meshes) {
    this._meshes = _meshes;
  }
  pointRaycast(id, frustum) {
    const shell = ShellUtils.getShell(this._meshes, id);
    const points = [];
    this.cast(shell, frustum, points);
    return points;
  }
  cast(shell, frustum, points) {
    const count = shell.pointsLength();
    for (let id = 0; id < count; id++) {
      ShellUtils.point(shell, id, this._tempVec);
      const pointFound = frustum.containsPoint(this._tempVec);
      if (!pointFound) continue;
      const point = this._tempVec.clone();
      points.push({ point });
    }
  }
}
export {
  ShellPointRaycaster
};
//# sourceMappingURL=shell-point-raycaster.mjs.map
