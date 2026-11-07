import { IS_LEAFNODE_FLAG, UINT32_PER_NODE } from "../Constants.mjs";
function IS_LEAF(n16, uint16Array) {
  return uint16Array[n16 + 15] === IS_LEAFNODE_FLAG;
}
function OFFSET(n32, uint32Array) {
  return uint32Array[n32 + 6];
}
function COUNT(n16, uint16Array) {
  return uint16Array[n16 + 14];
}
function LEFT_NODE(n32) {
  return n32 + UINT32_PER_NODE;
}
function RIGHT_NODE(n32, uint32Array) {
  const relativeOffset = uint32Array[n32 + 6];
  return n32 + relativeOffset * UINT32_PER_NODE;
}
function SPLIT_AXIS(n32, uint32Array) {
  return uint32Array[n32 + 7];
}
function BOUNDING_DATA_INDEX(n32) {
  return n32;
}
export {
  BOUNDING_DATA_INDEX,
  COUNT,
  IS_LEAF,
  LEFT_NODE,
  OFFSET,
  RIGHT_NODE,
  SPLIT_AXIS
};
//# sourceMappingURL=nodeBufferUtils.mjs.map
