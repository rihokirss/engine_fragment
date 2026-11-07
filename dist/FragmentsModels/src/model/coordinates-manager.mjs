import * as THREE from "three";
class CoordinatesManager {
  _coordinationMatrices = /* @__PURE__ */ new Map();
  async getCoordinationMatrix(model) {
    let matrix = this._coordinationMatrices.get(model.modelId);
    if (matrix) {
      return matrix;
    }
    matrix = new THREE.Matrix4();
    this._coordinationMatrices.set(model.modelId, matrix);
    const [x, y, z, xx, xy, xz, yx, yy, yz] = await this.getCoordinates(model);
    const xDir = new THREE.Vector3(xx, xy, xz);
    const yDir = new THREE.Vector3(yx, yy, yz);
    const zDir = new THREE.Vector3().crossVectors(xDir, yDir);
    matrix.set(
      xx,
      yx,
      zDir.x,
      x,
      xy,
      yy,
      zDir.y,
      y,
      xz,
      yz,
      zDir.z,
      z,
      0,
      0,
      0,
      1
    );
    return matrix;
  }
  async getCoordinates(model) {
    return model._invoke("getCoordinates");
  }
  async getPositions(model, localIds) {
    const args = [localIds];
    const localPositions = await model._invoke("getPositions", args);
    return this.getAbsolutePositions(localPositions, model);
  }
  getAbsolutePositions(result, model) {
    const positions = [];
    for (const position of result) {
      const { x, y, z } = position;
      const vector = new THREE.Vector3(x, y, z);
      vector.applyMatrix4(model.object.matrixWorld);
      positions.push(vector);
    }
    return positions;
  }
}
export {
  CoordinatesManager
};
//# sourceMappingURL=coordinates-manager.mjs.map
