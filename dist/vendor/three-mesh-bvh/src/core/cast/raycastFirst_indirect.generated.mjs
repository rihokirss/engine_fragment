import { IS_LEAF, OFFSET, COUNT, SPLIT_AXIS, RIGHT_NODE, LEFT_NODE } from "../utils/nodeBufferUtils.mjs";
import { BufferStack } from "../utils/BufferStack.mjs";
import { intersectRay } from "../utils/intersectUtils.mjs";
import { intersectClosestTri_indirect } from "../utils/iterationUtils_indirect.generated.mjs";
const _xyzFields = ["x", "y", "z"];
function raycastFirst_indirect(bvh, root, materialOrSide, ray, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _raycastFirst(0, bvh, materialOrSide, ray, near, far);
  BufferStack.clearBuffer();
  return result;
}
function _raycastFirst(nodeIndex32, bvh, materialOrSide, ray, near, far) {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);
    return intersectClosestTri_indirect(bvh, materialOrSide, ray, offset, count, near, far);
  } else {
    const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array);
    const xyzAxis = _xyzFields[splitAxis];
    const rayDir = ray.direction[xyzAxis];
    const leftToRight = rayDir >= 0;
    let c1, c2;
    if (leftToRight) {
      c1 = LEFT_NODE(nodeIndex32);
      c2 = RIGHT_NODE(nodeIndex32, uint32Array);
    } else {
      c1 = RIGHT_NODE(nodeIndex32, uint32Array);
      c2 = LEFT_NODE(nodeIndex32);
    }
    const c1Intersection = intersectRay(c1, float32Array, ray, near, far);
    const c1Result = c1Intersection ? _raycastFirst(c1, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result) {
      const point = c1Result.point[xyzAxis];
      const isOutside = leftToRight ? point <= float32Array[c2 + splitAxis] : (
        // min bounding data
        point >= float32Array[c2 + splitAxis + 3]
      );
      if (isOutside) {
        return c1Result;
      }
    }
    const c2Intersection = intersectRay(c2, float32Array, ray, near, far);
    const c2Result = c2Intersection ? _raycastFirst(c2, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result && c2Result) {
      return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
    } else {
      return c1Result || c2Result || null;
    }
  }
}
export {
  raycastFirst_indirect
};
//# sourceMappingURL=raycastFirst_indirect.generated.mjs.map
