import { EditRequestType } from "../../../../Utils/edit/edit-types.mjs";
const DELETED = /* @__PURE__ */ Symbol("deleted index");
class VirtualIndexesController {
  _vm;
  _storedByName = /* @__PURE__ */ new Map();
  _storedNames = null;
  /** Overlay built from pending CREATE/UPDATE/DELETE_INDEX requests. */
  _overlay = null;
  /** Length of the request list when the overlay was built; rebuild on mismatch. */
  _overlayRequestsLen = -1;
  constructor(vm) {
    this._vm = vm;
  }
  /**
   * Names of every index visible to the model right now: stored names
   * minus those deleted by pending requests, plus names introduced by
   * pending CREATE_INDEX requests.
   */
  getNames() {
    const overlay = this.overlay();
    const stored = this.storedNames();
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const name of stored) {
      const o = overlay.get(name);
      if (o === DELETED) continue;
      out.push(name);
      seen.add(name);
    }
    for (const [name, entry] of overlay) {
      if (entry === DELETED) continue;
      if (seen.has(name)) continue;
      out.push(name);
    }
    return out;
  }
  /**
   * Describe the shape of a named index without performing any lookups.
   * Returns `null` if no index with that name exists or it has been deleted.
   */
  getInfo(name) {
    const entry = this.resolve(name);
    return entry ? entry.info : null;
  }
  /**
   * Return the keys of an index. Useful for keys-only indexes (membership
   * tests, iteration) but valid for any mode. Number keys come back as a
   * `Uint32Array`, string keys as a fresh `string[]`.
   */
  getKeys(name) {
    const entry = this.resolve(name);
    if (!entry) return null;
    return entry.info.keyType === "number" ? this.materializeNumberKeys(entry) : this.materializeStringKeys(entry);
  }
  getKey(name, index) {
    const entry = this.resolve(name);
    if (!entry) return null;
    return entry.info.keyType === "number" ? this.materializeNumberKeys(entry)[index] ?? null : this.readStringKey(entry.source, index);
  }
  getValues(name) {
    const entry = this.resolve(name);
    if (!entry) return null;
    if (entry.info.valueType === "none") return null;
    const inverse = this.inverseMap(entry);
    return Array.from(inverse.keys());
  }
  /**
   * Test whether a key exists in the named index without resolving its value.
   */
  has(name, key) {
    const entry = this.resolve(name);
    if (!entry) return false;
    if (typeof key !== entry.info.keyType) return false;
    return this.keyMap(entry).has(key);
  }
  /**
   * Forward lookup for a single key. The return shape depends on the index
   * mode (see {@link IndexEntry}). Returns `null` if the index or key is
   * missing, or the key type doesn't match.
   */
  getEntry(name, key) {
    const entry = this.resolve(name);
    if (!entry) return null;
    if (typeof key !== entry.info.keyType) return null;
    const position = this.keyMap(entry).get(key);
    if (position === void 0) return null;
    const { mode, valueType } = entry.info;
    if (mode === "keysOnly" || valueType === "none") return null;
    if (mode === "oneToOne") {
      return this.readScalarValue(entry, position);
    }
    const [start, end] = this.sliceBounds(entry, position);
    if (end <= start) {
      return valueType === "number" ? new Uint32Array(0) : [];
    }
    return valueType === "number" ? this.readNumberSlice(entry, start, end) : this.readStringSlice(entry, start, end);
  }
  /**
   * Inverse lookup. For a value, return every key that maps to it. Builds
   * and caches the inverse map on first call.
   */
  getInverseEntry(name, value) {
    const entry = this.resolve(name);
    if (!entry) return null;
    if (entry.info.valueType === "none") return null;
    if (typeof value !== entry.info.valueType) return null;
    const inverse = this.inverseMap(entry);
    const keys = inverse.get(value);
    if (!keys) return null;
    return entry.info.keyType === "number" ? Uint32Array.from(keys) : keys.slice();
  }
  /**
   * Discard cached resolved data. Stored entries are dropped; the pending
   * overlay is rebuilt on the next read. Useful if model data is mutated
   * out-of-band (which the public API doesn't do today).
   */
  invalidate(name) {
    if (name === void 0) {
      this._storedByName.clear();
      this._storedNames = null;
      this._overlay = null;
      this._overlayRequestsLen = -1;
      return;
    }
    this._storedByName.delete(name);
    if (this._storedNames) {
      const i = this._storedNames.indexOf(name);
      if (i !== -1) this._storedNames.splice(i, 1);
    }
    if (this._overlay) this._overlay.delete(name);
  }
  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------
  resolve(name) {
    const overlay = this.overlay();
    const pending = overlay.get(name);
    if (pending === DELETED) return null;
    if (pending !== void 0) return pending;
    return this.resolveStored(name);
  }
  resolveStored(name) {
    const cached = this._storedByName.get(name);
    if (cached) return cached;
    const length = this._vm.data.indexesLength();
    for (let i = 0; i < length; i++) {
      const fb = this._vm.data.indexes(i);
      if (!fb) continue;
      if (fb.name() !== name) continue;
      const entry = this.entryFromFb(fb, name);
      this._storedByName.set(name, entry);
      return entry;
    }
    return null;
  }
  storedNames() {
    if (this._storedNames) return this._storedNames;
    const names = [];
    const length = this._vm.data.indexesLength();
    for (let i = 0; i < length; i++) {
      const idx = this._vm.data.indexes(i);
      if (!idx) continue;
      const name = idx.name();
      if (!name) continue;
      names.push(name);
    }
    this._storedNames = names;
    return names;
  }
  overlay() {
    const requests = this._vm.requests;
    if (this._overlay !== null && this._overlayRequestsLen === requests.length) {
      return this._overlay;
    }
    const map = /* @__PURE__ */ new Map();
    for (const r of requests) {
      if (r.type === EditRequestType.CREATE_INDEX || r.type === EditRequestType.UPDATE_INDEX) {
        map.set(r.data.name, this.entryFromRaw(r.data));
      } else if (r.type === EditRequestType.DELETE_INDEX) {
        map.set(r.name, DELETED);
      }
    }
    this._overlay = map;
    this._overlayRequestsLen = requests.length;
    return map;
  }
  // ---------------------------------------------------------------------------
  // Entry construction
  // ---------------------------------------------------------------------------
  entryFromFb(fb, name) {
    const stringKeys = fb.stringKeysLength();
    const numberKeys = fb.numberKeysLength();
    const stringValues = fb.stringValuesLength();
    const numberValues = fb.numberValuesLength();
    const endLen = fb.endLength();
    const startLen = fb.startLength();
    const keyType = stringKeys > 0 ? "string" : "number";
    const size = keyType === "string" ? stringKeys : numberKeys;
    let valueType = "none";
    if (stringValues > 0) valueType = "string";
    else if (numberValues > 0) valueType = "number";
    let mode = "keysOnly";
    if (valueType !== "none") {
      if (endLen === 0) mode = "oneToOne";
      else mode = startLen > 0 ? "oneToNNonLinear" : "oneToNLinear";
    }
    return {
      source: { kind: "fb", fb },
      info: { name, mode, keyType, valueType, size },
      keyPositions: null,
      inverse: null
    };
  }
  entryFromRaw(data) {
    const keyType = typeof data.keys[0] === "string" ? "string" : "number";
    const size = data.keys.length;
    let valueType = "none";
    if (data.values && data.values.length > 0) {
      valueType = typeof data.values[0] === "string" ? "string" : "number";
    }
    let mode = "keysOnly";
    if (valueType !== "none") {
      const endLen = data.end?.length ?? 0;
      const startLen = data.start?.length ?? 0;
      if (endLen === 0) mode = "oneToOne";
      else mode = startLen > 0 ? "oneToNNonLinear" : "oneToNLinear";
    }
    const numberKeysArray = keyType === "number" ? Uint32Array.from(data.keys) : null;
    const numberValuesArray = valueType === "number" && data.values ? Uint32Array.from(data.values) : null;
    return {
      source: {
        kind: "raw",
        data,
        numberKeysArray,
        numberValuesArray
      },
      info: { name: data.name, mode, keyType, valueType, size },
      keyPositions: null,
      inverse: null
    };
  }
  // ---------------------------------------------------------------------------
  // Source-polymorphic readers
  // ---------------------------------------------------------------------------
  readNumberKey(src, i) {
    return src.kind === "fb" ? src.fb.numberKeys(i) : src.data.keys[i] ?? null;
  }
  readStringKey(src, i) {
    return src.kind === "fb" ? src.fb.stringKeys(i) : src.data.keys[i] ?? null;
  }
  readNumberValueAt(src, i) {
    return src.kind === "fb" ? src.fb.numberValues(i) : src.data.values[i] ?? null;
  }
  readStringValueAt(src, i) {
    return src.kind === "fb" ? src.fb.stringValues(i) : src.data.values[i] ?? null;
  }
  numberValuesArray(src) {
    return src.kind === "fb" ? src.fb.numberValuesArray() : src.numberValuesArray;
  }
  endAt(src, i) {
    return src.kind === "fb" ? src.fb.end(i) ?? 0 : src.data.end[i] ?? 0;
  }
  startAt(src, i) {
    return src.kind === "fb" ? src.fb.start(i) ?? 0 : src.data.start[i] ?? 0;
  }
  // ---------------------------------------------------------------------------
  // Lookup helpers
  // ---------------------------------------------------------------------------
  /** Lazily build the `key -> position in keys vector` map for forward lookup. */
  keyMap(entry) {
    if (entry.keyPositions) return entry.keyPositions;
    const map = /* @__PURE__ */ new Map();
    const { source, info } = entry;
    if (info.keyType === "number") {
      for (let i = 0; i < info.size; i++) {
        const k = this.readNumberKey(source, i);
        if (k === null) continue;
        map.set(k, i);
      }
    } else {
      for (let i = 0; i < info.size; i++) {
        const k = this.readStringKey(source, i);
        if (k === null) continue;
        map.set(k, i);
      }
    }
    entry.keyPositions = map;
    return map;
  }
  sliceBounds(entry, position) {
    const { source, info } = entry;
    if (info.mode === "oneToNNonLinear") {
      const start2 = this.startAt(source, position);
      const end2 = this.endAt(source, position);
      return [start2, end2];
    }
    const end = this.endAt(source, position);
    const start = position > 0 ? this.endAt(source, position - 1) : 0;
    return [start, end];
  }
  readScalarValue(entry, position) {
    const { source, info } = entry;
    if (info.valueType === "number") {
      return this.readNumberValueAt(source, position);
    }
    return this.readStringValueAt(source, position);
  }
  readNumberSlice(entry, start, end) {
    const all = this.numberValuesArray(entry.source);
    if (!all) return new Uint32Array(0);
    return all.subarray(start, end);
  }
  readStringSlice(entry, start, end) {
    const out = new Array(end - start);
    for (let i = start; i < end; i++) {
      out[i - start] = this.readStringValueAt(entry.source, i) ?? "";
    }
    return out;
  }
  materializeNumberKeys(entry) {
    if (entry.source.kind === "fb") {
      return entry.source.fb.numberKeysArray() ?? new Uint32Array(0);
    }
    return entry.source.numberKeysArray ?? new Uint32Array(0);
  }
  materializeStringKeys(entry) {
    const out = new Array(entry.info.size);
    for (let i = 0; i < entry.info.size; i++) {
      out[i] = this.readStringKey(entry.source, i) ?? "";
    }
    return out;
  }
  /** Lazily build the inverse map. */
  inverseMap(entry) {
    if (entry.inverse) return entry.inverse;
    const map = /* @__PURE__ */ new Map();
    const { source, info } = entry;
    const pushKey = (value, key) => {
      const existing = map.get(value);
      if (existing) {
        existing.push(key);
        return;
      }
      map.set(
        value,
        info.keyType === "number" ? [key] : [key]
      );
    };
    for (let i = 0; i < info.size; i++) {
      const key = info.keyType === "number" ? this.readNumberKey(source, i) : this.readStringKey(source, i);
      if (key === null) continue;
      if (info.mode === "oneToOne") {
        const v = this.readScalarValue(entry, i);
        if (v !== null) pushKey(v, key);
        continue;
      }
      if (info.mode === "oneToNLinear" || info.mode === "oneToNNonLinear") {
        const [start, end] = this.sliceBounds(entry, i);
        for (let j = start; j < end; j++) {
          const v = info.valueType === "number" ? this.readNumberValueAt(source, j) : this.readStringValueAt(source, j);
          if (v !== null && v !== void 0) pushKey(v, key);
        }
      }
    }
    entry.inverse = map;
    return map;
  }
}
export {
  VirtualIndexesController
};
//# sourceMappingURL=virtual-indexes-controller.mjs.map
