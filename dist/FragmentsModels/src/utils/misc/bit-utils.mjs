import { limitOf2Bytes } from "../../model/model-types.mjs";
class BitUtils {
  static check(data, id, config) {
    const filter = this.get(config);
    const currentData = data[id];
    const result = Boolean(currentData & filter);
    return result;
  }
  static apply(data, id, config, value) {
    const filter = this.get(config);
    if (value) {
      data[id] |= filter;
      return;
    }
    data[id] &= ~filter;
  }
  static checkMemory(id) {
    if (id >= limitOf2Bytes) {
      throw new Error("Fragments: Memory overflow!");
    }
  }
  static get(value) {
    return 1 << value;
  }
}
export {
  BitUtils
};
//# sourceMappingURL=bit-utils.mjs.map
