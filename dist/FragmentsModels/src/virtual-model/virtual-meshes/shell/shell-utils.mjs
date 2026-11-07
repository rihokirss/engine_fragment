import * as THREE from "three";
import { normalizationValue } from "../types.mjs";
import { Shell } from "../../../../../Schema/shell.mjs";
import { FloatVector } from "../../../../../Schema/float-vector.mjs";
import { ShellProfile } from "../../../../../Schema/shell-profile.mjs";
import { BigShellProfile } from "../../../../../Schema/big-shell-profile.mjs";
import { ShellHole } from "../../../../../Schema/shell-hole.mjs";
import { BigShellHole } from "../../../../../Schema/big-shell-hole.mjs";
import { ShellType } from "../../../../../Schema/shell-type.mjs";
class ShellUtils {
  static _faceThreshold = Math.cos(Math.PI / 8);
  static _shell = new Shell();
  static _normalBuffer = new Int16Array();
  static _tempNormal = new THREE.Vector3();
  static _tempPoint = new FloatVector();
  static _shellProfile = new ShellProfile();
  static _bigShellProfile = new BigShellProfile();
  static _shellHole = new ShellHole();
  static _bigShellHole = new BigShellHole();
  static _pointsByProfile = /* @__PURE__ */ new Map();
  static _v1 = new THREE.Vector3();
  static _v2 = new THREE.Vector3();
  static _v3 = new THREE.Vector3();
  static getProfile(shell, id, input) {
    const isBigShell = shell.type() === ShellType.BIG;
    if (isBigShell) {
      return shell.bigProfiles(id, input);
    }
    return shell.profiles(id, input);
  }
  static getPoints(shell) {
    const points = new Float32Array(shell.pointsLength() * 3);
    for (let i = 0; i < shell.pointsLength(); i++) {
      shell.points(i, this._tempPoint);
      points[i * 3] = this._tempPoint.x();
      points[i * 3 + 1] = this._tempPoint.y();
      points[i * 3 + 2] = this._tempPoint.z();
    }
    return points;
  }
  static getProfileIndices(shell, profileId) {
    const isBigShell = shell.type() === ShellType.BIG;
    const indices = {
      outer: [],
      inners: []
    };
    const length = isBigShell ? shell.bigHolesLength() : shell.holesLength();
    const holeId = isBigShell ? "bigHoles" : "holes";
    const profile = ShellUtils.getProfile(shell, profileId);
    indices.outer = Array.from(profile.indicesArray());
    for (let i = 0; i < length; i++) {
      const hole = shell[holeId](i);
      if (hole.profileId() === profileId) {
        const currentIndices = Array.from(hole.indicesArray());
        indices.inners.push(currentIndices);
      }
    }
    return indices;
  }
  static getHole(shell, id, input) {
    const isBigShell = shell.type() === ShellType.BIG;
    if (isBigShell) {
      return shell.bigHoles(id, input);
    }
    return shell.holes(id, input);
  }
  static getProfilesLength(shell) {
    if (shell.type() === ShellType.BIG) {
      return shell.bigProfilesLength();
    }
    return shell.profilesLength();
  }
  static getHolesLength(shell) {
    if (shell.type() === ShellType.BIG) {
      return shell.bigHolesLength();
    }
    return shell.holesLength();
  }
  static getShell(meshes, id) {
    return meshes.shells(id, this._shell);
  }
  static point(shell, id, result) {
    if (shell instanceof Shell) {
      shell.points(id, this._tempPoint);
    }
    const x = this._tempPoint.x();
    const y = this._tempPoint.y();
    const z = this._tempPoint.z();
    result.set(x, y, z);
  }
  static getNormalsOfShellProfile(shell, result) {
    const count = ShellUtils.getProfilesLength(shell);
    for (let id = 0; id < count; id++) {
      const profile = ShellUtils.getProfile(shell, id);
      const normals = this.fetchNormalsOfProfile(shell, profile);
      result.push(normals);
    }
    return result;
  }
  static computeNormalsAvg(indices, faceId, faceNormals, pointsFaces) {
    this.setupNormalBuffer(indices);
    const profileNormal = faceNormals[faceId];
    for (let id = 0; id < indices.length; id++) {
      const current = indices[id];
      const pointsByProfile = pointsFaces.get(current);
      this.aggregateNormals(pointsByProfile, faceNormals, profileNormal);
      this.computeAvgNormal(id);
    }
    return this._normalBuffer;
  }
  static getBuffer(shell) {
    const data = shell.bb;
    const distance = 8;
    const shellOffset = data.__offset(shell.bb_pos, distance);
    const length = shell.pointsLength() * 3;
    const offset = data.__vector(shell.bb_pos + shellOffset);
    const rawBytes = data.bytes();
    const rawBuffer = rawBytes.buffer;
    return new Float32Array(rawBuffer, offset, length);
  }
  static getPointsShell(shell) {
    this._pointsByProfile.clear();
    this.fetchAllPointsByProfile(shell);
    ShellUtils.fetchAllPointsByHole(shell);
    return this._pointsByProfile;
  }
  static addNormals(pointsByProfile, faceNormals, profileNormal) {
    for (const id of pointsByProfile) {
      const normal = faceNormals[id];
      const dot = profileNormal.dot(normal);
      const isValid = dot > this._faceThreshold;
      if (!isValid) continue;
      this._tempNormal.add(normal);
    }
  }
  static setupNormalBuffer(indices) {
    const neededSize = indices.length * 3;
    const currentSize = this._normalBuffer.length;
    const insufficientSize = currentSize < neededSize;
    if (insufficientSize) {
      this._normalBuffer = new Int16Array(neededSize);
    }
  }
  static fetchNormalsOfProfile(shell, profile) {
    const length = profile.indicesLength();
    const tooSmall = this.isTooSmall(shell, length);
    if (tooSmall) {
      return new THREE.Vector3(1, 0, 0);
    }
    return this.computeProfileNormal(length, profile, shell);
  }
  static fetchAllPointsByHole(shell) {
    const holesCount = ShellUtils.getHolesLength(shell);
    const hole = this.getTempHole(shell);
    for (let holeId = 0; holeId < holesCount; holeId++) {
      ShellUtils.getHole(shell, holeId, hole);
      const id = hole.profileId();
      const indicesCount = hole.indicesLength();
      for (let i = 0; i < indicesCount; i++) {
        const index = hole.indices(i);
        ShellUtils.savePointByProfile(index, id);
      }
    }
  }
  static computeProfileNormal(length, profile, shell) {
    this._v3.set(0, 0, 0);
    for (let id = 0; id < length; id++) {
      this.fetchPointsForNormal(id, length, profile, shell);
      this.computeProfilePointNormal();
    }
    const result = this._v3.clone();
    result.normalize();
    return result;
  }
  static computeProfilePointNormal() {
    const dx = this._v1.x - this._v2.x;
    const dy = this._v1.y - this._v2.y;
    const dz = this._v1.z - this._v2.z;
    const sumX = this._v1.x + this._v2.x;
    const sumY = this._v1.y + this._v2.y;
    const sumZ = this._v1.z + this._v2.z;
    this._v3.x += dy * sumZ;
    this._v3.y += dz * sumX;
    this._v3.z += dx * sumY;
  }
  static aggregateNormals(pointsByProfile, faceNormals, profileNormal) {
    this._tempNormal.set(0, 0, 0);
    const isZero = !pointsByProfile || !pointsByProfile.length;
    if (isZero) {
      this._tempNormal.set(1, 0, 0);
      return;
    }
    const isJustOne = pointsByProfile.length === 1;
    if (isJustOne) {
      const first = pointsByProfile[0];
      this._tempNormal = faceNormals[first].clone();
      return;
    }
    ShellUtils.addNormals(pointsByProfile, faceNormals, profileNormal);
  }
  static fetchPointsForNormal(id, length, profile, shell) {
    const next = id + 1;
    const id2 = next % length;
    const profile1 = profile.indices(id);
    const profile2 = profile.indices(id2);
    this.point(shell, profile1, this._v1);
    this.point(shell, profile2, this._v2);
  }
  static savePointByProfile(index, id) {
    if (!this._pointsByProfile.has(index)) {
      this._pointsByProfile.set(index, []);
    }
    this._pointsByProfile.get(index).push(id);
  }
  static isTooSmall(shell, length) {
    const notEnoughPoints = shell.pointsLength() <= 2;
    const notEnoughIndices = length <= 2;
    return notEnoughPoints || notEnoughIndices;
  }
  static fetchAllPointsByProfile(shell) {
    const count = this.getProfilesLength(shell);
    const profile = this.getTempProfile(shell);
    for (let id = 0; id < count; id++) {
      ShellUtils.getProfile(shell, id, profile);
      const indicesCount = profile.indicesLength();
      for (let i = 0; i < indicesCount; i++) {
        const index = profile.indices(i);
        ShellUtils.savePointByProfile(index, id);
      }
    }
  }
  static computeAvgNormal(id) {
    this._tempNormal.normalize();
    this._tempNormal.multiplyScalar(normalizationValue);
    this._tempNormal.toArray(this._normalBuffer, id * 3);
  }
  static getTempProfile(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellProfile;
    }
    return this._shellProfile;
  }
  static getTempHole(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellHole;
    }
    return this._shellHole;
  }
}
export {
  ShellUtils
};
//# sourceMappingURL=shell-utils.mjs.map
