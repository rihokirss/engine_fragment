import { ExtendedTriangle } from "../math/ExtendedTriangle.mjs";
import { PrimitivePool } from "./PrimitivePool.mjs";
class ExtendedTrianglePoolBase extends PrimitivePool {
  constructor() {
    super(() => new ExtendedTriangle());
  }
}
const ExtendedTrianglePool = /* @__PURE__ */ new ExtendedTrianglePoolBase();
export {
  ExtendedTrianglePool
};
//# sourceMappingURL=ExtendedTrianglePool.mjs.map
