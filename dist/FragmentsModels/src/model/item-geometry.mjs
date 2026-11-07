import * as THREE from "three";
class ItemGeometry {
  /**
   * The model that the geometry belongs to.
   */
  model;
  /**
   * The local ID of the item.
   */
  localId;
  /**
   * Creates a new ItemGeometry instance.
   * @param model - The model that the geometry belongs to.
   * @param localId - The local ID of the item.
   */
  constructor(model, localId) {
    this.model = model;
    this.localId = localId;
  }
  async get() {
    const [geometries] = await this.model._invoke("getItemsGeometry", [
      [this.localId]
    ]);
    for (const geometryData of geometries) {
      geometryData.transform = new THREE.Matrix4().fromArray(
        geometryData.transform.elements
      );
      const { indices, normals, positions, transform } = geometryData;
      if (!this._indices) this._indices = [];
      if (!this._normals) this._normals = [];
      if (!this._positions) this._positions = [];
      if (!this._transform) this._transform = [];
      this._indices.push(indices);
      this._normals.push(normals);
      this._positions.push(positions);
      this._transform.push(transform);
    }
    return geometries;
  }
  _indices = null;
  /**
   * Gets the indices of the item.
   */
  async getIndices() {
    if (this._indices !== null) return this._indices;
    await this.get();
    return this._indices;
  }
  _transform = null;
  /**
   * Gets the transform of the item.
   */
  async getTransform() {
    if (this._transform !== null) return this._transform;
    await this.get();
    return this._transform;
  }
  _normals = null;
  /**
   * Gets the normals of the item.
   */
  async getNormals() {
    if (this._normals !== null) return this._normals;
    await this.get();
    return this._normals;
  }
  _positions = null;
  /**
   * Gets the positions of the item.
   */
  async getPositions() {
    if (this._positions !== null) return this._positions;
    await this.get();
    return this._positions;
  }
  _vertices = null;
  /**
   * Gets the vertices of the item.
   */
  async getVertices() {
    if (this._vertices) return this._vertices;
    const allPositions = await this.getPositions();
    const allTransforms = await this.getTransform();
    if (!allPositions || !allTransforms) return this._vertices;
    this._vertices = [];
    for (let i = 0; i < allPositions.length; i++) {
      const positions = allPositions[i];
      const transform = allTransforms[i];
      if (!positions || !transform) continue;
      const currentVertices = [];
      this._vertices.push(currentVertices);
      const numVertices = Object.keys(positions).length / 3;
      const hashes = [];
      for (let i2 = 0; i2 < numVertices; i2++) {
        const x = positions[i2 * 3];
        const y = positions[i2 * 3 + 1];
        const z = positions[i2 * 3 + 2];
        if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
          continue;
        }
        const hash = `${x},${y},${z}`;
        if (hashes.includes(hash)) continue;
        hashes.push(hash);
        const vertex = new THREE.Vector3(x, y, z);
        vertex.applyMatrix4(transform);
        currentVertices.push(vertex);
      }
    }
    return this._vertices;
  }
  _triangles = null;
  /**
   * Gets the triangles of the item.
   */
  async getTriangles() {
    if (this._triangles) return this._triangles;
    const allIndices = await this.getIndices();
    const allPositions = await this.getPositions();
    const allTransforms = await this.getTransform();
    if (!allIndices || !allPositions || !allTransforms) return this._triangles;
    this._triangles = [];
    for (let i = 0; i < allIndices.length; i++) {
      const indices = allIndices[i];
      const positions = allPositions[i];
      const transform = allTransforms[i];
      if (!indices || !positions || !transform) continue;
      const currentTriangles = [];
      this._triangles.push(currentTriangles);
      for (let i2 = 0; i2 < indices.length; i2 += 3) {
        const a = indices[i2];
        const b = indices[i2 + 1];
        const c = indices[i2 + 2];
        const v1 = new THREE.Vector3(
          positions[a * 3],
          positions[a * 3 + 1],
          positions[a * 3 + 2]
        );
        const v2 = new THREE.Vector3(
          positions[b * 3],
          positions[b * 3 + 1],
          positions[b * 3 + 2]
        );
        const v3 = new THREE.Vector3(
          positions[c * 3],
          positions[c * 3 + 1],
          positions[c * 3 + 2]
        );
        v1.applyMatrix4(transform);
        v2.applyMatrix4(transform);
        v3.applyMatrix4(transform);
        currentTriangles.push(new THREE.Triangle(v1, v2, v3));
      }
    }
    return this._triangles;
  }
  _position = null;
  /**
   * Gets the position of the item.
   */
  async getPosition() {
    if (!this._position) {
      if (this.localId === null) return null;
      this._position = await this.model.getPositions([this.localId]);
    }
    return this._position;
  }
  _box = null;
  /**
   * Gets the box of the item.
   */
  async getBox() {
    if (!this._box) {
      if (this.localId === null) return null;
      this._box = await this.model.getBoxes([this.localId]);
    }
    return this._box;
  }
  /**
   * Sets the visibility of the item.
   * @param visible - Whether the item should be visible.
   */
  async setVisibility(visible) {
    await this.model.setVisible([this.localId], visible);
  }
  /**
   * Gets the visibility of the item.
   */
  async getVisibility() {
    const [result] = await this.model.getVisible([this.localId]);
    return result;
  }
}
export {
  ItemGeometry
};
//# sourceMappingURL=item-geometry.mjs.map
