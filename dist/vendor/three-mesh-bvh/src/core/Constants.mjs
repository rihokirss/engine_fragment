const CENTER = 0;
const AVERAGE = 1;
const SAH = 2;
const CONTAINED = 2;
const PRIMITIVE_INTERSECT_COST = 1.25;
const TRAVERSAL_COST = 1;
const BYTES_PER_NODE = 6 * 4 + 4 + 4;
const UINT32_PER_NODE = BYTES_PER_NODE / 4;
const IS_LEAFNODE_FLAG = 65535;
const FLOAT32_EPSILON = Math.pow(2, -24);
const SKIP_GENERATION = /* @__PURE__ */ Symbol("SKIP_GENERATION");
const DEFAULT_OPTIONS = {
  strategy: CENTER,
  maxDepth: 40,
  maxLeafSize: 10,
  useSharedArrayBuffer: false,
  setBoundingBox: true,
  onProgress: null,
  indirect: false,
  verbose: true,
  range: null,
  [SKIP_GENERATION]: false
};
export {
  AVERAGE,
  BYTES_PER_NODE,
  CENTER,
  CONTAINED,
  DEFAULT_OPTIONS,
  FLOAT32_EPSILON,
  IS_LEAFNODE_FLAG,
  PRIMITIVE_INTERSECT_COST,
  SAH,
  SKIP_GENERATION,
  TRAVERSAL_COST,
  UINT32_PER_NODE
};
//# sourceMappingURL=Constants.mjs.map
