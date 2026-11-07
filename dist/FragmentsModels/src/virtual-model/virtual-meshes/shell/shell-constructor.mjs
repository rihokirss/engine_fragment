import { PolygonSize } from "./types.mjs";
import { ShellUtils } from "./shell-utils.mjs";
import { limitOf2Bytes } from "../../../model/model-types.mjs";
import { ShellFaceX } from "./shell-face-x.mjs";
import { ShellFace4 } from "./shell-face-4.mjs";
import { ShellFace3 } from "./shell-face-3.mjs";
import { FloatVector } from "../../../../../Schema/float-vector.mjs";
import { ShellHole } from "../../../../../Schema/shell-hole.mjs";
import { BigShellHole } from "../../../../../Schema/big-shell-hole.mjs";
import { ShellProfile } from "../../../../../Schema/shell-profile.mjs";
import { BigShellProfile } from "../../../../../Schema/big-shell-profile.mjs";
import { Shell } from "../../../../../Schema/shell.mjs";
import { ShellType } from "../../../../../Schema/shell-type.mjs";
class ShellConstructor {
  point = new FloatVector();
  _shellHole = new ShellHole();
  _bigShellHole = new BigShellHole();
  interiorProfiles = /* @__PURE__ */ new Map();
  normalsAvgInterior = new Int16Array();
  _pointsPerProfile = /* @__PURE__ */ new Map();
  _shellProfile = new ShellProfile();
  _bigShellProfile = new BigShellProfile();
  _normalsAvg = new Int16Array();
  _normals = [];
  _indices = 0;
  _sizes = {
    vertices: 0,
    indices: 0,
    verticesAmount: 0,
    normalsAmount: 0,
    normals: 0
  };
  _tileData;
  _faceIdPerProfile = /* @__PURE__ */ new Map();
  construct(shell, meshData) {
    this.resetConstructData(meshData);
    this.getPointsPerWire(shell);
    const data = ShellUtils.getBuffer(shell);
    this.newShellInteriorProfiles(shell);
    this.constructShell(shell, data, meshData);
    this._tileData = void 0;
  }
  getIntProfileNormalsAvg(shell, id) {
    const hole = this.getTempHole(shell);
    const indices = hole.indicesArray();
    this.normalsAvgInterior = ShellUtils.computeNormalsAvg(
      indices,
      id,
      this._normals,
      this._pointsPerProfile
    );
  }
  saveInteriorProfile(shell) {
    const hole = this.getTempHole(shell);
    const id = hole.profileId();
    if (this.interiorProfiles.has(id)) {
      this.saveExistingInteriorProfile(id);
      return id;
    }
    const data = this.getNewIntProfileData();
    this.interiorProfiles.set(id, data);
    return id;
  }
  computeNormalsAvg(shell, indices, id) {
    const isShell = this.isShell(shell);
    if (!isShell) return;
    const n = this._normals;
    const ppp = this._pointsPerProfile;
    this._normalsAvg = ShellUtils.computeNormalsAvg(indices, id, n, ppp);
  }
  isShell(shell) {
    return shell instanceof Shell;
  }
  getPointsPerWire(shell) {
    const isShell = this.isShell(shell);
    if (!isShell) return;
    ShellUtils.getNormalsOfShellProfile(shell, this._normals);
    this._pointsPerProfile = ShellUtils.getPointsShell(shell);
  }
  getIndices(shell, id) {
    const profile = this.getTempProfile(shell);
    ShellUtils.getProfile(shell, id, profile);
    return profile.indicesArray();
  }
  resetConstructData(meshData) {
    this._indices = 0;
    this._tileData = void 0;
    this.nextBuffer(meshData);
    this._normals.length = 0;
  }
  initializeIndices() {
    const size = this._tileData.indexCount;
    this._tileData.indexBuffer = new Uint16Array(size);
  }
  constructFace4(indices, data, id) {
    const faceId = this._faceIdPerProfile.get(id);
    ShellFace4.create(
      indices,
      data,
      this._normalsAvg,
      id,
      this._tileData,
      this._sizes,
      faceId
    );
  }
  initializeSizes() {
    this._sizes.vertices = 0;
    this._sizes.indices = 0;
    this._sizes.verticesAmount = 0;
    this._sizes.normalsAmount = 0;
    this._sizes.normals = 0;
  }
  getInteriorProfileBuffer(shell, intProfile) {
    const hole = this.getTempHole(shell);
    const count = hole.indicesLength();
    const isShell = this.isShell(shell);
    if (!isShell) return;
    for (let id = 0; id < count; id++) {
      this.getIntProfilePoints(id, shell, intProfile);
      this.getIntProfileNormals(intProfile, id);
    }
  }
  constructProfile(id, shell, indices, data) {
    const profile = this.getTempProfile(shell);
    const indexAmount = profile.indicesLength();
    const notAHole = !this.interiorProfiles.has(id);
    const isFace3 = indexAmount === PolygonSize.three;
    if (isFace3 && notAHole) {
      this.constructFace3(indices, data, id);
      return;
    }
    const isFace4 = indexAmount === PolygonSize.four;
    if (isFace4 && notAHole) {
      this.constructFace4(indices, data, id);
      return;
    }
    this.constructFaceX(indices, data, id);
  }
  getIntProfileNormals(hole, id) {
    const index = id * 3;
    const nx = this.normalsAvgInterior[index];
    const ny = this.normalsAvgInterior[index + 1];
    const nz = this.normalsAvgInterior[index + 2];
    hole.normals.push(nx, ny, nz);
  }
  saveExistingInteriorProfile(id) {
    const found = this.interiorProfiles.get(id);
    const pointCount = found.points.length;
    const indexCount = pointCount / 3;
    found.indices.push(indexCount);
    this.interiorProfiles.set(id, found);
  }
  getNewIntProfileData() {
    const indices = [0];
    const points = [];
    const normals = [];
    return { indices, points, normals };
  }
  constructFace3(indices, data, id) {
    const faceId = this._faceIdPerProfile.get(id);
    ShellFace3.create(
      indices,
      data,
      this._normalsAvg,
      this._tileData,
      this._sizes,
      faceId
    );
  }
  getIntProfilePoints(i, shell, holeData) {
    const hole = this.getTempHole(shell);
    const shellIndex = hole.indices(i);
    shell.points(shellIndex, this.point);
    const px = this.point.x();
    const py = this.point.y();
    const pz = this.point.z();
    holeData.points.push(px, py, pz);
  }
  manageMemory(shell, meshData) {
    const profile = this.getTempProfile(shell);
    const indexAmount = profile.indicesLength();
    const vertexAmount = this._sizes.verticesAmount / 3;
    const memoryConsumed = vertexAmount + indexAmount;
    const memoryOverflow = memoryConsumed > limitOf2Bytes;
    if (memoryOverflow) {
      this.nextBuffer(meshData);
    }
  }
  nextBuffer = (bufferGeometries) => {
    this.setTileData(bufferGeometries);
    this.initializeIndices();
    this.initializePositions();
    this.initializeNormals();
    this.initializeFaceIds();
    this.initializeSizes();
    this._indices++;
  };
  initializeFaceIds() {
    const size = this._tileData.positionCount;
    this._tileData.faceIdBuffer = new Uint32Array(size / 3);
  }
  getNextFaceId() {
    const maxUint32 = 4294967295;
    return Math.random() * maxUint32;
  }
  newShellInteriorProfiles(shell) {
    this.interiorProfiles.clear();
    const count = ShellUtils.getHolesLength(shell);
    const hole = this.getTempHole(shell);
    for (let i = 0; i < count; i++) {
      ShellUtils.getHole(shell, i, hole);
      const id = this.saveInteriorProfile(shell);
      const intProfile = this.interiorProfiles.get(id);
      this.getIntProfileNormalsAvg(shell, id);
      this.getInteriorProfileBuffer(shell, intProfile);
    }
    return this.interiorProfiles;
  }
  initializePositions() {
    const size = this._tileData.positionCount;
    this._tileData.positionBuffer = new Float32Array(size);
  }
  initializeNormals() {
    const size = this._tileData.normalCount;
    this._tileData.normalBuffer = new Int16Array(size);
  }
  setTileData(bufferGeometries) {
    if (Array.isArray(bufferGeometries)) {
      this._tileData = bufferGeometries[this._indices];
      return;
    }
    this._tileData = bufferGeometries;
  }
  constructShell(shell, data, meshData) {
    this.getFaceIds(shell);
    const count = ShellUtils.getProfilesLength(shell);
    for (let id = 0; id < count; id++) {
      const indices = this.getIndices(shell, id);
      this.computeNormalsAvg(shell, indices, id);
      this.constructProfile(id, shell, indices, data);
      if (id < count - 1) this.manageMemory(shell, meshData);
    }
  }
  constructFaceX(indices, data, id) {
    const faceId = this._faceIdPerProfile.get(id);
    ShellFaceX.create(
      indices,
      data,
      this._normalsAvg,
      id,
      this._tileData,
      this.interiorProfiles,
      this._sizes,
      faceId
    );
  }
  getTempProfile(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellProfile;
    }
    return this._shellProfile;
  }
  getTempHole(shell) {
    if (shell.type() === ShellType.BIG) {
      return this._bigShellHole;
    }
    return this._shellHole;
  }
  getFaceIds(shell) {
    this._faceIdPerProfile.clear();
    const faceIds = shell.profilesFaceIdsArray();
    const colors = /* @__PURE__ */ new Map();
    if (faceIds && faceIds.length > 0) {
      for (let i = 0; i < faceIds.length; i++) {
        const rawFaceId = faceIds[i];
        if (!colors.has(rawFaceId)) {
          colors.set(rawFaceId, this.getNextFaceId());
        }
        const faceId = colors.get(rawFaceId);
        this._faceIdPerProfile.set(i, faceId);
      }
      return;
    }
    for (let i = 0; i < shell.profilesLength(); i++) {
      this._faceIdPerProfile.set(i, this.getNextFaceId());
    }
  }
}
export {
  ShellConstructor
};
//# sourceMappingURL=shell-constructor.mjs.map
