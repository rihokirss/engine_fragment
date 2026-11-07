class ShellFace3 {
  static vertexIncrease = 3;
  static totalIncrease = 9;
  static create(indices, data, normals, mesh, sizes, faceId) {
    this.setFaceIds(sizes, mesh, faceId);
    this.setIndices(mesh, sizes);
    this.setPoints(indices, mesh, sizes, data);
    this.setNormals(mesh, sizes, normals);
    this.updateData(sizes);
  }
  static setFaceIds(sizes, mesh, faceId) {
    const amount = sizes.verticesAmount;
    const firstFace = amount / 3;
    const lastFace = firstFace + 3;
    for (let i = firstFace; i < lastFace; i++) {
      mesh.faceIdBuffer[i] = faceId;
    }
  }
  static setNormals(mesh, sizes, normals) {
    const normal = mesh.normalBuffer;
    for (let i = 0; i < this.totalIncrease; i++) {
      normal[sizes.normalsAmount + i] = normals[i];
    }
  }
  static setPoints(indices, mesh, sizes, data) {
    let counter = 0;
    const points = mesh.positionBuffer;
    for (let i = 0; i < this.vertexIncrease; i++) {
      const index = indices[i] * this.vertexIncrease;
      for (let j = 0; j < this.vertexIncrease; j++) {
        points[sizes.verticesAmount + counter] = data[index + j];
        counter++;
      }
    }
  }
  static setIndices(mesh, sizes) {
    const index = mesh.indexBuffer;
    for (let i = 0; i < this.vertexIncrease; i++) {
      index[sizes.indices + i] = sizes.vertices + i;
    }
    sizes.indices += this.vertexIncrease;
  }
  static updateData(sizes) {
    sizes.normalsAmount += ShellFace3.totalIncrease;
    sizes.vertices += ShellFace3.vertexIncrease;
    sizes.verticesAmount += ShellFace3.totalIncrease;
  }
}
export {
  ShellFace3
};
//# sourceMappingURL=shell-face-3.mjs.map
