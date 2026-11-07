import { Box3 } from "three";
import { UINT32_PER_NODE, CONTAINED } from "../Constants.mjs";
import { arrayToBox } from "../../utils/ArrayBoxUtilities.mjs";
import { PrimitivePool } from "../../utils/PrimitivePool.mjs";
import { IS_LEAF, OFFSET, COUNT, BOUNDING_DATA_INDEX, RIGHT_NODE, LEFT_NODE } from "../utils/nodeBufferUtils.mjs";
import { BufferStack } from "../utils/BufferStack.mjs";
let _box1, _box2;
const boxStack = [];
const boxPool = /* @__PURE__ */ new PrimitivePool(() => new Box3());
function shapecast(bvh, root, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset) {
  _box1 = boxPool.getPrimitive();
  _box2 = boxPool.getPrimitive();
  boxStack.push(_box1, _box2);
  BufferStack.setBuffer(bvh._roots[root]);
  const result = shapecastTraverse(0, bvh.geometry, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset);
  BufferStack.clearBuffer();
  boxPool.releasePrimitive(_box1);
  boxPool.releasePrimitive(_box2);
  boxStack.pop();
  boxStack.pop();
  const length = boxStack.length;
  if (length > 0) {
    _box2 = boxStack[length - 1];
    _box1 = boxStack[length - 2];
  }
  return result;
}
function shapecastTraverse(nodeIndex32, geometry, intersectsBoundsFunc, intersectsRangeFunc, nodeScoreFunc = null, nodeIndexOffset = 0, depth = 0) {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);
    arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array, _box1);
    return intersectsRangeFunc(offset, count, false, depth, nodeIndexOffset + nodeIndex32 / UINT32_PER_NODE, _box1);
  } else {
    let getLeftOffset = function(nodeIndex322) {
      const { uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
      let nodeIndex162 = nodeIndex322 * 2;
      while (!IS_LEAF(nodeIndex162, uint16Array2)) {
        nodeIndex322 = LEFT_NODE(nodeIndex322);
        nodeIndex162 = nodeIndex322 * 2;
      }
      return OFFSET(nodeIndex322, uint32Array2);
    }, getRightEndOffset = function(nodeIndex322) {
      const { uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
      let nodeIndex162 = nodeIndex322 * 2;
      while (!IS_LEAF(nodeIndex162, uint16Array2)) {
        nodeIndex322 = RIGHT_NODE(nodeIndex322, uint32Array2);
        nodeIndex162 = nodeIndex322 * 2;
      }
      return OFFSET(nodeIndex322, uint32Array2) + COUNT(nodeIndex162, uint16Array2);
    };
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array);
    let c1 = left;
    let c2 = right;
    let score1, score2;
    let box1, box2;
    if (nodeScoreFunc) {
      box1 = _box1;
      box2 = _box2;
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array, box1);
      arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array, box2);
      score1 = nodeScoreFunc(box1);
      score2 = nodeScoreFunc(box2);
      if (score2 < score1) {
        c1 = right;
        c2 = left;
        const temp = score1;
        score1 = score2;
        score2 = temp;
        box1 = box2;
      }
    }
    if (!box1) {
      box1 = _box1;
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array, box1);
    }
    const isC1Leaf = IS_LEAF(c1 * 2, uint16Array);
    const c1Intersection = intersectsBoundsFunc(box1, isC1Leaf, score1, depth + 1, nodeIndexOffset + c1 / UINT32_PER_NODE);
    let c1StopTraversal;
    if (c1Intersection === CONTAINED) {
      const offset = getLeftOffset(c1);
      const end = getRightEndOffset(c1);
      const count = end - offset;
      c1StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexOffset + c1 / UINT32_PER_NODE, box1);
    } else {
      c1StopTraversal = c1Intersection && shapecastTraverse(
        c1,
        geometry,
        intersectsBoundsFunc,
        intersectsRangeFunc,
        nodeScoreFunc,
        nodeIndexOffset,
        depth + 1
      );
    }
    if (c1StopTraversal) return true;
    box2 = _box2;
    arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array, box2);
    const isC2Leaf = IS_LEAF(c2 * 2, uint16Array);
    const c2Intersection = intersectsBoundsFunc(box2, isC2Leaf, score2, depth + 1, nodeIndexOffset + c2 / UINT32_PER_NODE);
    let c2StopTraversal;
    if (c2Intersection === CONTAINED) {
      const offset = getLeftOffset(c2);
      const end = getRightEndOffset(c2);
      const count = end - offset;
      c2StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexOffset + c2 / UINT32_PER_NODE, box2);
    } else {
      c2StopTraversal = c2Intersection && shapecastTraverse(
        c2,
        geometry,
        intersectsBoundsFunc,
        intersectsRangeFunc,
        nodeScoreFunc,
        nodeIndexOffset,
        depth + 1
      );
    }
    if (c2StopTraversal) return true;
    return false;
  }
}
export {
  shapecast
};
//# sourceMappingURL=shapecast.mjs.map
