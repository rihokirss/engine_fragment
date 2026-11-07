import * as THREE from "three";
import { ShellUtils } from "./shell-utils.mjs";
import { ShellProfile } from "../../../../../Schema/shell-profile.mjs";
import { BigShellProfile } from "../../../../../Schema/big-shell-profile.mjs";
import { Shell } from "../../../../../Schema/shell.mjs";
import { ShellType } from "../../../../../Schema/shell-type.mjs";
class ShellLineRaycaster {
  _meshes;
  _minAngle = Math.PI / 32;
  _shellProfile = new ShellProfile();
  _bigShellProfile = new BigShellProfile();
  _tempV1 = new THREE.Vector3();
  _tempV2 = new THREE.Vector3();
  _tempPoint = new THREE.Vector3();
  _normals = [];
  _pointsByProfile = /* @__PURE__ */ new Map();
  _shell = new Shell();
  _result = [];
  constructor(meshes) {
    this._meshes = meshes;
  }
  lineRaycast(id, ray, frustum) {
    this.resetData(id);
    this.lineRaycastItems(ray, frustum);
    return this._result;
  }
  lineRaycastItems(ray, frustum) {
    const profilesCount = ShellUtils.getProfilesLength(this._shell);
    for (let id = 0; id < profilesCount; id++) {
      const profile = this.getTempProfile(this._shell);
      ShellUtils.getProfile(this._shell, id, profile);
      this.lineRaycastProfile(ray, frustum, id);
    }
  }
  resetData(id) {
    this._shell = ShellUtils.getShell(this._meshes, id);
    this._normals.length = 0;
    ShellUtils.getNormalsOfShellProfile(this._shell, this._normals);
    this._pointsByProfile = ShellUtils.getPointsShell(this._shell);
    this._result = [];
  }
  lineRaycastProfile(ray, frustum, id) {
    const profile = this.getTempProfile(this._shell);
    const indicesCount = profile.indicesLength();
    for (let i = 0; i < indicesCount; i++) {
      const i1 = profile.indices(i);
      const i2 = this.getSecondIndex(i, indicesCount);
      const success = this.cast(i1, i2, ray, frustum, id);
      if (success) {
        this.saveResult(id);
      }
    }
  }
  isInvalidAngle(firstIndex, secondIndex, id) {
    const profile = this.getProfile(firstIndex, secondIndex, id);
    if (!profile.length) {
      return true;
    }
    const normal1 = this._normals[profile[0]];
    const normal2 = this._normals[id];
    const angle = normal1.dot(normal2);
    return angle > Math.cos(this._minAngle);
  }
  getProfile(firstIndex, secondIndex, id) {
    const profile1 = this._pointsByProfile.get(firstIndex);
    const profile2 = this._pointsByProfile.get(secondIndex);
    const result = [];
    for (const index of profile1) {
      if (profile2.indexOf(index) === -1) continue;
      if (index === id) continue;
      result.push(index);
    }
    return result;
  }
  cast(i1, i2, ray, frustum, id) {
    ShellUtils.point(this._shell, i1, this._tempV1);
    ShellUtils.point(this._shell, i2, this._tempV2);
    this.raycastSegment(ray);
    const pointFound = frustum.containsPoint(this._tempPoint);
    if (!pointFound) {
      return false;
    }
    const invalidAngle = this.isInvalidAngle(i1, i2, id);
    if (invalidAngle) {
      return false;
    }
    return true;
  }
  saveResult(id) {
    const snappedEdgeP1 = this._tempV1.clone();
    const snappedEdgeP2 = this._tempV2.clone();
    const normal = this._normals[id];
    const point = this._tempPoint.clone();
    this._result.push({ point, normal, snappedEdgeP1, snappedEdgeP2 });
  }
  getSecondIndex(id, count) {
    const isLast = id === count - 1;
    const profile = this.getTempProfile(this._shell);
    if (isLast) {
      return profile.indices(0);
    }
    return profile.indices(id + 1);
  }
  raycastSegment(ray) {
    ray.distanceSqToSegment(
      this._tempV1,
      this._tempV2,
      void 0,
      this._tempPoint
    );
  }
  getTempProfile(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellProfile;
    }
    return this._shellProfile;
  }
}
export {
  ShellLineRaycaster
};
//# sourceMappingURL=shell-line-raycaster.mjs.map
