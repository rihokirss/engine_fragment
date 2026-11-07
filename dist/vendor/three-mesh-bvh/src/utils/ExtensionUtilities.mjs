import { Mesh, LineSegments, LineLoop, Line, Points, Sphere, BatchedMesh } from "three";
import { MeshBVH } from "../core/MeshBVH.mjs";
const _raycastFunctions = {
  "Mesh": Mesh.prototype.raycast,
  "Line": Line.prototype.raycast,
  "LineSegments": LineSegments.prototype.raycast,
  "LineLoop": LineLoop.prototype.raycast,
  "Points": Points.prototype.raycast,
  "BatchedMesh": BatchedMesh.prototype.raycast
};
const _mesh = /* @__PURE__ */ new Mesh();
const _batchIntersects = [];
function acceleratedRaycast(raycaster, intersects) {
  if (this.isBatchedMesh) {
    acceleratedBatchedMeshRaycast.call(this, raycaster, intersects);
  } else {
    const { geometry } = this;
    if (geometry.boundsTree) {
      geometry.boundsTree.raycastObject3D(this, raycaster, intersects);
    } else {
      let raycastFunction;
      if (this instanceof Mesh) {
        raycastFunction = _raycastFunctions.Mesh;
      } else if (this instanceof LineSegments) {
        raycastFunction = _raycastFunctions.LineSegments;
      } else if (this instanceof LineLoop) {
        raycastFunction = _raycastFunctions.LineLoop;
      } else if (this instanceof Line) {
        raycastFunction = _raycastFunctions.Line;
      } else if (this instanceof Points) {
        raycastFunction = _raycastFunctions.Points;
      } else {
        throw new Error("BVH: Fallback raycast function not found.");
      }
      raycastFunction.call(this, raycaster, intersects);
    }
  }
}
function acceleratedBatchedMeshRaycast(raycaster, intersects) {
  if (this.boundsTrees) {
    const boundsTrees = this.boundsTrees;
    const drawInfo = this._drawInfo || this._instanceInfo;
    const drawRanges = this._drawRanges || this._geometryInfo;
    const matrixWorld = this.matrixWorld;
    _mesh.material = this.material;
    _mesh.geometry = this.geometry;
    const oldBoundsTree = _mesh.geometry.boundsTree;
    const oldDrawRange = _mesh.geometry.drawRange;
    if (_mesh.geometry.boundingSphere === null) {
      _mesh.geometry.boundingSphere = new Sphere();
    }
    for (let i = 0, l = drawInfo.length; i < l; i++) {
      if (!this.getVisibleAt(i)) {
        continue;
      }
      const geometryId = drawInfo[i].geometryIndex;
      _mesh.geometry.boundsTree = boundsTrees[geometryId];
      this.getMatrixAt(i, _mesh.matrixWorld).premultiply(matrixWorld);
      if (!_mesh.geometry.boundsTree) {
        this.getBoundingBoxAt(geometryId, _mesh.geometry.boundingBox);
        this.getBoundingSphereAt(geometryId, _mesh.geometry.boundingSphere);
        const drawRange = drawRanges[geometryId];
        _mesh.geometry.setDrawRange(drawRange.start, drawRange.count);
      }
      _mesh.raycast(raycaster, _batchIntersects);
      for (let j = 0, l2 = _batchIntersects.length; j < l2; j++) {
        const intersect = _batchIntersects[j];
        intersect.object = this;
        intersect.batchId = i;
        intersects.push(intersect);
      }
      _batchIntersects.length = 0;
    }
    _mesh.geometry.boundsTree = oldBoundsTree;
    _mesh.geometry.drawRange = oldDrawRange;
    _mesh.material = null;
    _mesh.geometry = null;
  } else {
    _raycastFunctions.BatchedMesh.call(this, raycaster, intersects);
  }
}
function computeBoundsTree(options = {}) {
  const { type = MeshBVH } = options;
  this.boundsTree = new type(this, options);
  return this.boundsTree;
}
function disposeBoundsTree() {
  this.boundsTree = null;
}
export {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree
};
//# sourceMappingURL=ExtensionUtilities.mjs.map
