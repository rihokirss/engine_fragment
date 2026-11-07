import { BufferAttribute, Matrix4, Ray, Vector3, FrontSide } from "three";
import { SKIP_GENERATION, BYTES_PER_NODE, UINT32_PER_NODE, FLOAT32_EPSILON } from "./Constants.mjs";
import { OrientedBox } from "../math/OrientedBox.mjs";
import { ExtendedTrianglePool } from "../utils/ExtendedTrianglePool.mjs";
import { closestPointToPoint } from "./cast/closestPointToPoint.mjs";
import { IS_LEAF } from "./utils/nodeBufferUtils.mjs";
import { iterateOverTriangles } from "./utils/iterationUtils.generated.mjs";
import { refit } from "./cast/refit.generated.mjs";
import { raycast } from "./cast/raycast.generated.mjs";
import { raycastFirst } from "./cast/raycastFirst.generated.mjs";
import { intersectsGeometry } from "./cast/intersectsGeometry.generated.mjs";
import { closestPointToGeometry } from "./cast/closestPointToGeometry.generated.mjs";
import { iterateOverTriangles_indirect } from "./utils/iterationUtils_indirect.generated.mjs";
import { refit_indirect } from "./cast/refit_indirect.generated.mjs";
import { raycast_indirect } from "./cast/raycast_indirect.generated.mjs";
import { raycastFirst_indirect } from "./cast/raycastFirst_indirect.generated.mjs";
import { intersectsGeometry_indirect } from "./cast/intersectsGeometry_indirect.generated.mjs";
import { closestPointToGeometry_indirect } from "./cast/closestPointToGeometry_indirect.generated.mjs";
import { setTriangle } from "../utils/TriangleUtilities.mjs";
import { convertRaycastIntersect } from "../utils/GeometryRayIntersectUtilities.mjs";
import { GeometryBVH } from "./GeometryBVH.mjs";
const _obb = /* @__PURE__ */ new OrientedBox();
const _ray = /* @__PURE__ */ new Ray();
const _direction = /* @__PURE__ */ new Vector3();
const _inverseMatrix = /* @__PURE__ */ new Matrix4();
const _worldScale = /* @__PURE__ */ new Vector3();
const _getters = ["getX", "getY", "getZ"];
class MeshBVH extends GeometryBVH {
  static serialize(bvh, options = {}) {
    options = {
      cloneBuffers: true,
      ...options
    };
    const geometry = bvh.geometry;
    const rootData = bvh._roots;
    const indirectBuffer = bvh._indirectBuffer;
    const indexAttribute = geometry.getIndex();
    const result = {
      version: 1,
      roots: null,
      index: null,
      indirectBuffer: null
    };
    if (options.cloneBuffers) {
      result.roots = rootData.map((root) => root.slice());
      result.index = indexAttribute ? indexAttribute.array.slice() : null;
      result.indirectBuffer = indirectBuffer ? indirectBuffer.slice() : null;
    } else {
      result.roots = rootData;
      result.index = indexAttribute ? indexAttribute.array : null;
      result.indirectBuffer = indirectBuffer;
    }
    return result;
  }
  static deserialize(data, geometry, options = {}) {
    options = {
      setIndex: true,
      indirect: Boolean(data.indirectBuffer),
      ...options
    };
    const { index, roots, indirectBuffer } = data;
    if (!data.version) {
      console.warn(
        "MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data."
      );
      fixupVersion0(roots);
    }
    const bvh = new MeshBVH(geometry, { ...options, [SKIP_GENERATION]: true });
    bvh._roots = roots;
    bvh._indirectBuffer = indirectBuffer || null;
    if (options.setIndex) {
      const indexAttribute = geometry.getIndex();
      if (indexAttribute === null) {
        const newIndex = new BufferAttribute(data.index, 1, false);
        geometry.setIndex(newIndex);
      } else if (indexAttribute.array !== index) {
        indexAttribute.array.set(index);
        indexAttribute.needsUpdate = true;
      }
    }
    return bvh;
    function fixupVersion0(roots2) {
      for (let rootIndex = 0; rootIndex < roots2.length; rootIndex++) {
        const root = roots2[rootIndex];
        const uint32Array = new Uint32Array(root);
        const uint16Array = new Uint16Array(root);
        for (let node = 0, l = root.byteLength / BYTES_PER_NODE; node < l; node++) {
          const node32Index = UINT32_PER_NODE * node;
          const node16Index = 2 * node32Index;
          if (!IS_LEAF(node16Index, uint16Array)) {
            uint32Array[node32Index + 6] = uint32Array[node32Index + 6] / UINT32_PER_NODE - node;
          }
        }
      }
    }
  }
  get primitiveStride() {
    return 3;
  }
  get resolveTriangleIndex() {
    return this.resolvePrimitiveIndex;
  }
  constructor(geometry, options = {}) {
    if (options.maxLeafTris) {
      console.warn('MeshBVH: "maxLeafTris" option has been deprecated. Use maxLeafSize, instead.');
      options = {
        ...options,
        maxLeafSize: options.maxLeafTris
      };
    }
    super(geometry, options);
  }
  // implement abstract methods from BVH base class
  shiftTriangleOffsets(offset) {
    return super.shiftPrimitiveOffsets(offset);
  }
  // write primitive bounds to the buffer - used only for validateBounds at the moment
  writePrimitiveBounds(i, targetBuffer, baseIndex) {
    const geometry = this.geometry;
    const indirectBuffer = this._indirectBuffer;
    const posAttr = geometry.attributes.position;
    const index = geometry.index ? geometry.index.array : null;
    const tri = indirectBuffer ? indirectBuffer[i] : i;
    const tri3 = tri * 3;
    let ai = tri3 + 0;
    let bi = tri3 + 1;
    let ci = tri3 + 2;
    if (index) {
      ai = index[ai];
      bi = index[bi];
      ci = index[ci];
    }
    for (let el = 0; el < 3; el++) {
      const a = posAttr[_getters[el]](ai);
      const b = posAttr[_getters[el]](bi);
      const c = posAttr[_getters[el]](ci);
      let min = a;
      if (b < min) min = b;
      if (c < min) min = c;
      let max = a;
      if (b > max) max = b;
      if (c > max) max = c;
      targetBuffer[baseIndex + el] = min;
      targetBuffer[baseIndex + el + 3] = max;
    }
    return targetBuffer;
  }
  // precomputes the bounding box for each triangle; required for quickly calculating tree splits.
  // result is an array of size count * 6 where triangle i maps to a
  // [x_center, x_delta, y_center, y_delta, z_center, z_delta] tuple starting at index (i - offset) * 6,
  // representing the center and half-extent in each dimension of triangle i
  computePrimitiveBounds(offset, count, targetBuffer) {
    const geometry = this.geometry;
    const indirectBuffer = this._indirectBuffer;
    const posAttr = geometry.attributes.position;
    const index = geometry.index ? geometry.index.array : null;
    const normalized = posAttr.normalized;
    if (offset < 0 || count + offset - targetBuffer.offset > targetBuffer.length / 6) {
      throw new Error("MeshBVH: compute triangle bounds range is invalid.");
    }
    const posArr = posAttr.array;
    const bufferOffset = posAttr.offset || 0;
    let stride = 3;
    if (posAttr.isInterleavedBufferAttribute) {
      stride = posAttr.data.stride;
    }
    const getters = ["getX", "getY", "getZ"];
    const writeOffset = targetBuffer.offset;
    for (let i = offset, l = offset + count; i < l; i++) {
      const tri = indirectBuffer ? indirectBuffer[i] : i;
      const tri3 = tri * 3;
      const boundsIndexOffset = (i - writeOffset) * 6;
      let ai = tri3 + 0;
      let bi = tri3 + 1;
      let ci = tri3 + 2;
      if (index) {
        ai = index[ai];
        bi = index[bi];
        ci = index[ci];
      }
      if (!normalized) {
        ai = ai * stride + bufferOffset;
        bi = bi * stride + bufferOffset;
        ci = ci * stride + bufferOffset;
      }
      for (let el = 0; el < 3; el++) {
        let a, b, c;
        if (normalized) {
          a = posAttr[getters[el]](ai);
          b = posAttr[getters[el]](bi);
          c = posAttr[getters[el]](ci);
        } else {
          a = posArr[ai + el];
          b = posArr[bi + el];
          c = posArr[ci + el];
        }
        let min = a;
        if (b < min) min = b;
        if (c < min) min = c;
        let max = a;
        if (b > max) max = b;
        if (c > max) max = c;
        const halfExtents = (max - min) / 2;
        const el2 = el * 2;
        targetBuffer[boundsIndexOffset + el2 + 0] = min + halfExtents;
        targetBuffer[boundsIndexOffset + el2 + 1] = halfExtents + (Math.abs(min) + halfExtents) * FLOAT32_EPSILON;
      }
    }
    return targetBuffer;
  }
  raycastObject3D(object, raycaster, intersects = []) {
    const { material } = object;
    if (material === void 0) {
      return;
    }
    _inverseMatrix.copy(object.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    _worldScale.setFromMatrixScale(object.matrixWorld);
    _direction.copy(_ray.direction).multiply(_worldScale);
    const scaleFactor = _direction.length();
    const near = raycaster.near / scaleFactor;
    const far = raycaster.far / scaleFactor;
    if (raycaster.firstHitOnly === true) {
      let hit = this.raycastFirst(_ray, material, near, far);
      hit = convertRaycastIntersect(hit, object, raycaster);
      if (hit) {
        intersects.push(hit);
      }
    } else {
      const hits = this.raycast(_ray, material, near, far);
      for (let i = 0, l = hits.length; i < l; i++) {
        const hit = convertRaycastIntersect(hits[i], object, raycaster);
        if (hit) {
          intersects.push(hit);
        }
      }
    }
    return intersects;
  }
  refit(nodeIndices = null) {
    const refitFunc = this.indirect ? refit_indirect : refit;
    return refitFunc(this, nodeIndices);
  }
  /* Core Cast Functions */
  raycast(ray, materialOrSide = FrontSide, near = 0, far = Infinity) {
    const roots = this._roots;
    const intersects = [];
    const raycastFunc = this.indirect ? raycast_indirect : raycast;
    for (let i = 0, l = roots.length; i < l; i++) {
      raycastFunc(this, i, materialOrSide, ray, intersects, near, far);
    }
    return intersects;
  }
  raycastFirst(ray, materialOrSide = FrontSide, near = 0, far = Infinity) {
    const roots = this._roots;
    let closestResult = null;
    const raycastFirstFunc = this.indirect ? raycastFirst_indirect : raycastFirst;
    for (let i = 0, l = roots.length; i < l; i++) {
      const result = raycastFirstFunc(this, i, materialOrSide, ray, near, far);
      if (result != null && (closestResult == null || result.distance < closestResult.distance)) {
        closestResult = result;
      }
    }
    return closestResult;
  }
  intersectsGeometry(otherGeometry, geomToMesh) {
    let result = false;
    const roots = this._roots;
    const intersectsGeometryFunc = this.indirect ? intersectsGeometry_indirect : intersectsGeometry;
    for (let i = 0, l = roots.length; i < l; i++) {
      result = intersectsGeometryFunc(this, i, otherGeometry, geomToMesh);
      if (result) {
        break;
      }
    }
    return result;
  }
  shapecast(callbacks) {
    const triangle = ExtendedTrianglePool.getPrimitive();
    const result = super.shapecast(
      {
        ...callbacks,
        intersectsPrimitive: callbacks.intersectsTriangle,
        scratchPrimitive: triangle,
        // TODO: is the performance significant enough for the added complexity here?
        // can we just use one function?
        iterate: this.indirect ? iterateOverTriangles_indirect : iterateOverTriangles
      }
    );
    ExtendedTrianglePool.releasePrimitive(triangle);
    return result;
  }
  bvhcast(otherBvh, matrixToLocal, callbacks) {
    let {
      intersectsRanges,
      intersectsTriangles
    } = callbacks;
    const triangle1 = ExtendedTrianglePool.getPrimitive();
    const indexAttr1 = this.geometry.index;
    const positionAttr1 = this.geometry.attributes.position;
    const assignTriangle1 = this.indirect ? (i1) => {
      const ti = this.resolveTriangleIndex(i1);
      setTriangle(triangle1, ti * 3, indexAttr1, positionAttr1);
    } : (i1) => {
      setTriangle(triangle1, i1 * 3, indexAttr1, positionAttr1);
    };
    const triangle2 = ExtendedTrianglePool.getPrimitive();
    const indexAttr2 = otherBvh.geometry.index;
    const positionAttr2 = otherBvh.geometry.attributes.position;
    const assignTriangle2 = otherBvh.indirect ? (i2) => {
      const ti2 = otherBvh.resolveTriangleIndex(i2);
      setTriangle(triangle2, ti2 * 3, indexAttr2, positionAttr2);
    } : (i2) => {
      setTriangle(triangle2, i2 * 3, indexAttr2, positionAttr2);
    };
    if (intersectsTriangles) {
      if (!(otherBvh instanceof MeshBVH)) {
        throw new Error('MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.');
      }
      const iterateOverDoubleTriangles = (offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2) => {
        for (let i2 = offset2, l2 = offset2 + count2; i2 < l2; i2++) {
          assignTriangle2(i2);
          triangle2.a.applyMatrix4(matrixToLocal);
          triangle2.b.applyMatrix4(matrixToLocal);
          triangle2.c.applyMatrix4(matrixToLocal);
          triangle2.needsUpdate = true;
          for (let i1 = offset1, l1 = offset1 + count1; i1 < l1; i1++) {
            assignTriangle1(i1);
            triangle1.needsUpdate = true;
            if (intersectsTriangles(triangle1, triangle2, i1, i2, depth1, nodeIndex1, depth2, nodeIndex2)) {
              return true;
            }
          }
        }
        return false;
      };
      if (intersectsRanges) {
        const originalIntersectsRanges = intersectsRanges;
        intersectsRanges = function(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2) {
          if (!originalIntersectsRanges(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2)) {
            return iterateOverDoubleTriangles(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2);
          }
          return true;
        };
      } else {
        intersectsRanges = iterateOverDoubleTriangles;
      }
    }
    return super.bvhcast(otherBvh, matrixToLocal, { intersectsRanges });
  }
  /* Derived Cast Functions */
  intersectsBox(box, boxToMesh) {
    _obb.set(box.min, box.max, boxToMesh);
    _obb.needsUpdate = true;
    return this.shapecast(
      {
        intersectsBounds: (box2) => _obb.intersectsBox(box2),
        intersectsTriangle: (tri) => _obb.intersectsTriangle(tri)
      }
    );
  }
  intersectsSphere(sphere) {
    return this.shapecast(
      {
        intersectsBounds: (box) => sphere.intersectsBox(box),
        intersectsTriangle: (tri) => tri.intersectsSphere(sphere)
      }
    );
  }
  closestPointToGeometry(otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
    const closestPointToGeometryFunc = this.indirect ? closestPointToGeometry_indirect : closestPointToGeometry;
    return closestPointToGeometryFunc(
      this,
      otherGeometry,
      geometryToBvh,
      target1,
      target2,
      minThreshold,
      maxThreshold
    );
  }
  closestPointToPoint(point, target = {}, minThreshold = 0, maxThreshold = Infinity) {
    return closestPointToPoint(
      this,
      point,
      target,
      minThreshold,
      maxThreshold
    );
  }
}
export {
  MeshBVH
};
//# sourceMappingURL=MeshBVH.mjs.map
