import { CRCData } from "./crc-data.mjs";
import { IntHelper } from "./int-helper.mjs";
import { MaterialUtils } from "../geometry/material-utils.mjs";
class CRC {
  static _polynomial = 2197175160;
  _core = new CRCData();
  _handlers;
  _result = -1;
  get value() {
    return ~this._result;
  }
  constructor() {
    this._handlers = this.newHandlers();
  }
  fromMaterialData(data) {
    const {
      modelId,
      objectClass,
      currentLod,
      templateId,
      ...materialDefinition
    } = data;
    this.reset();
    this.compute(modelId);
    this.compute(objectClass);
    this.compute(MaterialUtils.getKey(materialDefinition));
    this.compute(currentLod);
    this.compute(templateId !== void 0);
  }
  generate(input) {
    this.reset();
    for (const item of input) {
      this.compute(item);
    }
    return this.value;
  }
  compute(input) {
    const handler = this.getHandler(input);
    handler(input);
    return this;
  }
  reset() {
    this._result = -1;
    return this;
  }
  getHandler(input) {
    const inputType = typeof input;
    const handler = this._handlers[inputType];
    if (!handler) {
      throw new Error("Fragments: Unsupported input type");
    }
    return handler;
  }
  newHandlers() {
    return {
      number: this.handleNumber,
      boolean: this.handleBoolean,
      string: this.handleString,
      object: this.handleObject
    };
  }
  handleObject = (input) => {
    const keys = Object.keys(input);
    for (const key of keys) {
      if (!input.hasOwnProperty(key)) {
        continue;
      }
      this.compute(input[key]);
    }
  };
  handleString = (input) => {
    const size = input.length;
    for (let i = 0; i < size; ++i) {
      const result = input.codePointAt(i);
      this._core.int[0] = result;
      this.update();
    }
  };
  handleBoolean = (input) => {
    if (input) {
      this._core.int[0] = 1;
    } else {
      this._core.int[0] = 0;
    }
    this.update();
  };
  handleNumber = (input) => {
    const isInt = IntHelper.check(input);
    const target = isInt ? this._core.int : this._core.float;
    target[0] = input;
    this.update();
  };
  update() {
    for (let i = 0; i < this._core.s1; ++i) {
      this._result ^= this._core.buffer[i];
      for (let j = 0; j < this._core.s2; ++j) {
        if (this._result & 1) {
          this._result = this._result >> 1 ^ CRC._polynomial;
        } else {
          this._result >>= 1;
        }
      }
    }
  }
}
export {
  CRC
};
//# sourceMappingURL=crc.mjs.map
