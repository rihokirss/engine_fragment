import { ItemConfigClass } from "../../model/model-types.mjs";
import { BitUtils } from "../../utils/misc/bit-utils.mjs";
class ItemConfigController {
  size;
  _data;
  _highlightData;
  constructor(size) {
    this.size = size;
    this._data = new Uint8Array(size);
    this._highlightData = new Uint16Array(size);
    this._data.fill(1);
  }
  getHighlight(id) {
    return this._highlightData[id];
  }
  setHighlight(id, highlightId) {
    BitUtils.checkMemory(highlightId);
    this._highlightData[id] = highlightId;
  }
  clearHighlight() {
    this._highlightData.fill(0);
  }
  hasAnyHighlight() {
    for (let i = 0; i < this._highlightData.length; i++) {
      if (this._highlightData[i] !== 0) return true;
    }
    return false;
  }
  visible(id) {
    return BitUtils.check(this._data, id, ItemConfigClass.VISIBLE);
  }
  setVisible(id, visible) {
    BitUtils.apply(this._data, id, ItemConfigClass.VISIBLE, visible);
  }
  clearVisible() {
    this._data.fill(1);
  }
}
export {
  ItemConfigController
};
//# sourceMappingURL=item-config-controller.mjs.map
