import { intersectRay } from "../utils/intersectUtils.mjs";
import { IS_LEAF, OFFSET, COUNT, RIGHT_NODE, LEFT_NODE } from "../utils/nodeBufferUtils.mjs";
import { BufferStack } from "../utils/BufferStack.mjs";
import { intersectTris } from "../utils/iterationUtils.generated.mjs";
function raycast(bvh, root, materialOrSide, ray, intersects, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  _raycast(0, bvh, materialOrSide, ray, intersects, near, far);
  BufferStack.clearBuffer();
}
function _raycast(nodeIndex32, bvh, materialOrSide, ray, intersects, near, far) {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  const nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);
    intersectTris(bvh, materialOrSide, ray, offset, count, intersects, near, far);
  } else {
    const leftIndex = LEFT_NODE(nodeIndex32);
    if (intersectRay(leftIndex, float32Array, ray, near, far)) {
      _raycast(leftIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
    const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array);
    if (intersectRay(rightIndex, float32Array, ray, near, far)) {
      _raycast(rightIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
  }
}
export {
  raycast
};
//# sourceMappingURL=raycast.generated.mjs.map
