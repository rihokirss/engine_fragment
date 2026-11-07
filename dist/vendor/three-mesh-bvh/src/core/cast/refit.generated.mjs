import { UINT32_PER_NODE, BYTES_PER_NODE } from "../Constants.mjs";
import { IS_LEAF, OFFSET, COUNT, RIGHT_NODE, LEFT_NODE } from "../utils/nodeBufferUtils.mjs";
function refit(bvh, nodeIndices = null) {
  if (nodeIndices && Array.isArray(nodeIndices)) {
    nodeIndices = new Set(nodeIndices);
  }
  const geometry = bvh.geometry;
  const indexArr = geometry.index ? geometry.index.array : null;
  const posAttr = geometry.attributes.position;
  let buffer, uint32Array, uint16Array, float32Array;
  let byteOffset = 0;
  const roots = bvh._roots;
  for (let i = 0, l = roots.length; i < l; i++) {
    buffer = roots[i];
    uint32Array = new Uint32Array(buffer);
    uint16Array = new Uint16Array(buffer);
    float32Array = new Float32Array(buffer);
    _traverse(0, byteOffset);
    byteOffset += buffer.byteLength;
  }
  function _traverse(nodeIndex32, byteOffset2, force = false) {
    const nodeIndex16 = nodeIndex32 * 2;
    if (IS_LEAF(nodeIndex16, uint16Array)) {
      const offset = OFFSET(nodeIndex32, uint32Array);
      const count = COUNT(nodeIndex16, uint16Array);
      let minx = Infinity;
      let miny = Infinity;
      let minz = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      let maxz = -Infinity;
      for (let i = 3 * offset, l = 3 * (offset + count); i < l; i++) {
        let index = indexArr[i];
        const x = posAttr.getX(index);
        const y = posAttr.getY(index);
        const z = posAttr.getZ(index);
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
        if (z < minz) minz = z;
        if (z > maxz) maxz = z;
      }
      if (float32Array[nodeIndex32 + 0] !== minx || float32Array[nodeIndex32 + 1] !== miny || float32Array[nodeIndex32 + 2] !== minz || float32Array[nodeIndex32 + 3] !== maxx || float32Array[nodeIndex32 + 4] !== maxy || float32Array[nodeIndex32 + 5] !== maxz) {
        float32Array[nodeIndex32 + 0] = minx;
        float32Array[nodeIndex32 + 1] = miny;
        float32Array[nodeIndex32 + 2] = minz;
        float32Array[nodeIndex32 + 3] = maxx;
        float32Array[nodeIndex32 + 4] = maxy;
        float32Array[nodeIndex32 + 5] = maxz;
        return true;
      } else {
        return false;
      }
    } else {
      const left = LEFT_NODE(nodeIndex32);
      const right = RIGHT_NODE(nodeIndex32, uint32Array);
      let forceChildren = force;
      let includesLeft = false;
      let includesRight = false;
      if (nodeIndices) {
        if (!forceChildren) {
          const leftNodeId = left / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          const rightNodeId = right / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          includesLeft = nodeIndices.has(leftNodeId);
          includesRight = nodeIndices.has(rightNodeId);
          forceChildren = !includesLeft && !includesRight;
        }
      } else {
        includesLeft = true;
        includesRight = true;
      }
      const traverseLeft = forceChildren || includesLeft;
      const traverseRight = forceChildren || includesRight;
      let leftChange = false;
      if (traverseLeft) {
        leftChange = _traverse(left, byteOffset2, forceChildren);
      }
      let rightChange = false;
      if (traverseRight) {
        rightChange = _traverse(right, byteOffset2, forceChildren);
      }
      const didChange = leftChange || rightChange;
      if (didChange) {
        for (let i = 0; i < 3; i++) {
          const left_i = left + i;
          const right_i = right + i;
          const minLeftValue = float32Array[left_i];
          const maxLeftValue = float32Array[left_i + 3];
          const minRightValue = float32Array[right_i];
          const maxRightValue = float32Array[right_i + 3];
          float32Array[nodeIndex32 + i] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
          float32Array[nodeIndex32 + i + 3] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;
        }
      }
      return didChange;
    }
  }
}
export {
  refit
};
//# sourceMappingURL=refit.generated.mjs.map
