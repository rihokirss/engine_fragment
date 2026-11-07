class MiscHelper {
  static fixNumber(value) {
    if (Number.isNaN(value)) {
      return 0;
    }
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value;
  }
  static forEach(items, callback) {
    if (Array.isArray(items)) {
      let counter = 0;
      for (const item of items) {
        callback(item, counter++);
      }
      return;
    }
    callback(items, 0);
  }
}
export {
  MiscHelper
};
//# sourceMappingURL=misc-helper.mjs.map
