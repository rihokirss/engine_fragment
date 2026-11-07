import * as THREE from "three";
import { ShellFaceX } from "./shell-face-x.mjs";
class ShellFace4 {
  static a = new THREE.Vector3();
  static b = new THREE.Vector3();
  static c = new THREE.Vector3();
  static d = new THREE.Vector3();
  static e = new THREE.Vector3();
  static f = new THREE.Vector3();
  static g = new THREE.Vector3();
  static h = new THREE.Vector3();
  static i = new THREE.Vector3();
  static _vecs = [this.a, this.b, this.c, this.d];
  static _convexIndices = [0, 1, 3, 3, 1, 2];
  static totalIncrease = 12;
  static indexIncrease = 6;
  static vertexIncrease = 4;
  static create(indices, data, normals, id, mesh, sizes, faceId) {
    this.setAllVectors(indices, data);
    const isConvex = this.getIsConvex();
    if (isConvex) {
      this.processConvexFace4(mesh, sizes, normals, faceId);
      return;
    }
    ShellFaceX.create(
      indices,
      data,
      normals,
      id,
      mesh,
      void 0,
      sizes,
      faceId
    );
  }
  static setAllVectors(indices, data) {
    this.setVector(indices, data, this.a, 0);
    this.setVector(indices, data, this.b, 1);
    this.setVector(indices, data, this.c, 2);
    this.setVector(indices, data, this.d, 3);
    this.getCrossVectors();
  }
  static processConvexFace4(mesh, sizes, normals, faceId) {
    this.processIndices(mesh, sizes);
    this.processPoints(mesh, sizes);
    this.processNormal(mesh, sizes, normals);
    this.setFaceId(mesh, sizes, faceId);
    this.updateData(sizes);
  }
  static setFaceId(mesh, sizes, faceId) {
    const faceIds = mesh.faceIdBuffer;
    for (let i = sizes.vertices; i < sizes.vertices + 4; i++) {
      faceIds[i] = faceId;
    }
  }
  static getIsConvex() {
    return this.h.dot(this.i) > 0;
  }
  static getCrossVectors() {
    this.e.copy(this.b);
    this.f.copy(this.c);
    this.g.copy(this.d);
    this.e.sub(this.a);
    this.f.sub(this.a);
    this.g.sub(this.a);
    this.h.crossVectors(this.e, this.f);
    this.i.crossVectors(this.f, this.g);
  }
  static updateData(sizes) {
    sizes.normalsAmount += this.totalIncrease;
    sizes.vertices += this.vertexIncrease;
    sizes.verticesAmount += this.totalIncrease;
  }
  static processPoints(mesh, sizes) {
    let counter = 0;
    const position = mesh.positionBuffer;
    const amount = sizes.verticesAmount;
    for (let i = 0; i < this.vertexIncrease; i++) {
      const vec = this._vecs[i];
      position[amount + counter++] = vec.x;
      position[amount + counter++] = vec.y;
      position[amount + counter++] = vec.z;
    }
  }
  static setVector(indices, data, vector, offset) {
    const index = indices[offset] * 3;
    const x = data[index];
    const y = data[index + 1];
    const z = data[index + 2];
    vector.set(x, y, z);
  }
  static processNormal(mesh, sizes, normals) {
    const normal = mesh.normalBuffer;
    const amount = sizes.normalsAmount;
    for (let i = 0; i < this.totalIncrease; i++) {
      normal[amount + i] = normals[i];
    }
  }
  static processIndices(mesh, sizes) {
    const indices = mesh.indexBuffer;
    for (let i = 0; i < this.indexIncrease; i++) {
      const offset = this._convexIndices[i];
      indices[sizes.indices + i] = sizes.vertices + offset;
    }
    sizes.indices += this.indexIncrease;
  }
}
export {
  ShellFace4
};
//# sourceMappingURL=shell-face-4.mjs.map
