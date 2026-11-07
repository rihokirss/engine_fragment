import { ModelIndex } from "../../Schema/model-index.mjs";
function buildIndex(builder, data) {
  const nameOffset = builder.createString(data.name);
  const { keysOffset, isStringKey } = createKeysVector(builder, data.keys);
  const { valuesOffset, isStringValue } = createValuesVector(
    builder,
    data.values
  );
  const endOffset = data.end?.length ? ModelIndex.createEndVector(builder, data.end) : null;
  const startOffset = data.start?.length ? ModelIndex.createStartVector(builder, data.start) : null;
  ModelIndex.startModelIndex(builder);
  ModelIndex.addName(builder, nameOffset);
  if (isStringKey) {
    ModelIndex.addStringKeys(builder, keysOffset);
  } else {
    ModelIndex.addNumberKeys(builder, keysOffset);
  }
  if (valuesOffset !== null) {
    if (isStringValue) {
      ModelIndex.addStringValues(builder, valuesOffset);
    } else {
      ModelIndex.addNumberValues(builder, valuesOffset);
    }
  }
  if (endOffset !== null) ModelIndex.addEnd(builder, endOffset);
  if (startOffset !== null) ModelIndex.addStart(builder, startOffset);
  return ModelIndex.endModelIndex(builder);
}
function copyIndex(builder, src) {
  const data = readIndex(src);
  return buildIndex(builder, data);
}
function readIndex(src) {
  const name = src.name() ?? "";
  const stringKeysLen = src.stringKeysLength();
  const stringValuesLen = src.stringValuesLength();
  const numberValuesLen = src.numberValuesLength();
  const endLen = src.endLength();
  const startLen = src.startLength();
  let keys;
  if (stringKeysLen > 0) {
    const arr = new Array(stringKeysLen);
    for (let i = 0; i < stringKeysLen; i++) arr[i] = src.stringKeys(i) ?? "";
    keys = arr;
  } else {
    const numberKeys = src.numberKeysArray();
    keys = numberKeys ? Array.from(numberKeys) : [];
  }
  let values;
  if (stringValuesLen > 0) {
    const arr = new Array(stringValuesLen);
    for (let i = 0; i < stringValuesLen; i++) {
      arr[i] = src.stringValues(i) ?? "";
    }
    values = arr;
  } else if (numberValuesLen > 0) {
    const numberValues = src.numberValuesArray();
    values = numberValues ? Array.from(numberValues) : [];
  }
  let end;
  if (endLen > 0) {
    const arr = src.endArray();
    end = arr ? Array.from(arr) : [];
  }
  let start;
  if (startLen > 0) {
    const arr = src.startArray();
    start = arr ? Array.from(arr) : [];
  }
  return { name, keys, values, end, start };
}
function createKeysVector(builder, keys) {
  if (keys.length === 0) {
    return {
      keysOffset: ModelIndex.createNumberKeysVector(builder, []),
      isStringKey: false
    };
  }
  if (typeof keys[0] === "string") {
    const offsets = keys.map((s) => builder.createString(s));
    return {
      keysOffset: ModelIndex.createStringKeysVector(builder, offsets),
      isStringKey: true
    };
  }
  return {
    keysOffset: ModelIndex.createNumberKeysVector(
      builder,
      keys
    ),
    isStringKey: false
  };
}
function createValuesVector(builder, values) {
  if (!values || values.length === 0) {
    return { valuesOffset: null, isStringValue: false };
  }
  if (typeof values[0] === "string") {
    const offsets = values.map((s) => builder.createString(s));
    return {
      valuesOffset: ModelIndex.createStringValuesVector(builder, offsets),
      isStringValue: true
    };
  }
  return {
    valuesOffset: ModelIndex.createNumberValuesVector(
      builder,
      values
    ),
    isStringValue: false
  };
}
export {
  buildIndex,
  copyIndex
};
//# sourceMappingURL=index-functions.mjs.map
