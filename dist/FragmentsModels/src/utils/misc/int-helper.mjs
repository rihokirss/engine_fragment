class IntHelper {
  static _max = 2147483647;
  static _min = -2147483648;
  static check(data) {
    const isInteger = Number.isInteger(data);
    const notOverflow = data < this._max;
    const notUnderflow = data > this._min;
    return isInteger && notOverflow && notUnderflow;
  }
}
export {
  IntHelper
};
//# sourceMappingURL=int-helper.mjs.map
