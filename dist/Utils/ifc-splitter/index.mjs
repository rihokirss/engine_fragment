import { Event } from "../event.mjs";
import { extractArgsString, splitIfcArgs, extractRefs, extractLineMeta, parseHashRef } from "../ifc-parsing-utils.mjs";
import { streamAsyncIterator } from "../ifc-stream.mjs";
const ELEMENT_TYPES = Object.freeze([
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCWALLELEMENTEDCASE",
  "IFCSLAB",
  "IFCSLABSTANDARDCASE",
  "IFCSLABELEMENTEDCASE",
  "IFCBEAM",
  "IFCBEAMSTANDARDCASE",
  "IFCCOLUMN",
  "IFCCOLUMNSTANDARDCASE",
  "IFCDOOR",
  "IFCDOORSTANDARDCASE",
  "IFCWINDOW",
  "IFCWINDOWSTANDARDCASE",
  "IFCROOF",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCRAMP",
  "IFCRAMPFLIGHT",
  "IFCCURTAINWALL",
  "IFCCOVERING",
  "IFCRAILING",
  "IFCPLATE",
  "IFCPLATESTANDARDCASE",
  "IFCMEMBER",
  "IFCMEMBERSTANDARDCASE",
  "IFCFOOTING",
  "IFCPILE",
  "IFCFURNISHINGELEMENT",
  "IFCSANITARYTERMINAL",
  "IFCFLOWSEGMENT",
  "IFCFLOWTERMINAL",
  "IFCFLOWCONTROLLER",
  "IFCFLOWFITTING",
  "IFCFLOWMOVINGDEVICE",
  "IFCFLOWSTORAGEDEVICE",
  "IFCFLOWTREATMENTDEVICE",
  "IFCENERGYCONVERSIONDEVICE",
  "IFCDISTRIBUTIONFLOWELEMENT",
  "IFCDISTRIBUTIONCONTROLELEMENT",
  "IFCDISTRIBUTIONELEMENT",
  "IFCDISTRIBUTIONPORT",
  "IFCBUILDINGELEMENTPROXY",
  "IFCBUILDINGELEMENTPART",
  "IFCOPENINGELEMENT",
  "IFCSPACE",
  "IFCTRANSPORTELEMENT",
  "IFCVIRTUALELEMENT",
  "IFCSHADINGDEVICE",
  "IFCCHIMNEY",
  "IFCGEOGRAPHICELEMENT",
  "IFCPROXY",
  "IFCMECHANICALFASTENER"
]);
const SPATIAL_TYPES = Object.freeze([
  "IFCPROJECT",
  "IFCSITE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY"
]);
const listIdxByType = (type) => {
  switch (type) {
    case "IFCRELAGGREGATES":
      return 5;
    case "IFCRELCONNECTSWITHREALIZINGELEMENTS":
      return 7;
    case "IFCPRESENTATIONLAYERASSIGNMENT":
      return 2;
    default:
      return 4;
  }
};
const shouldRewriteType = (type) => {
  if (type === "IFCRELVOIDSELEMENT") return false;
  if (type === "IFCRELFILLSELEMENT") return false;
  if (type.startsWith("IFCREL")) return true;
  if (type === "IFCPRESENTATIONLAYERASSIGNMENT") return true;
  return false;
};
class IdSlots {
  /** Smallest size of the flat table, in ids. */
  static MIN_DIRECT = 1 << 16;
  /** How many ids per stored line the flat table may span. */
  static DIRECT_IDS_PER_LINE = 4;
  /** Slot + 1 for each id below `direct.length`. 0 means no slot. */
  direct = new Uint32Array(IdSlots.MIN_DIRECT);
  /** Slot of each id the flat table does not reach. */
  sparse = /* @__PURE__ */ new Map();
  count = 0;
  get size() {
    return this.count;
  }
  /** The slot of `id`, or -1 if it has none. */
  get(id) {
    if (id < this.direct.length) {
      return (this.direct[id] ?? 0) - 1;
    }
    return this.sparse.get(id) ?? -1;
  }
  /** The slot of `id`, assigning the next free one if it has none. */
  add(id) {
    const existing = this.get(id);
    if (existing >= 0) return existing;
    const slot = this.count++;
    if (id >= this.direct.length && id < this.directLimit()) this.grow(id);
    if (id < this.direct.length) this.direct[id] = slot + 1;
    else this.sparse.set(id, slot);
    return slot;
  }
  directLimit() {
    return Math.max(
      IdSlots.MIN_DIRECT,
      this.count * IdSlots.DIRECT_IDS_PER_LINE
    );
  }
  grow(id) {
    const direct = new Uint32Array(Math.max(id + 1, this.direct.length * 2));
    direct.set(this.direct);
    for (const [sparseId, slot] of this.sparse) {
      if (sparseId >= direct.length) continue;
      direct[sparseId] = slot + 1;
      this.sparse.delete(sparseId);
    }
    this.direct = direct;
  }
}
class GrowableUint32 {
  buf = new Uint32Array(1 << 16);
  get(i) {
    return this.buf[i];
  }
  set(i, value) {
    if (i >= this.buf.length) {
      const buf = new Uint32Array(Math.max(this.buf.length * 2, i + 1));
      buf.set(this.buf);
      this.buf = buf;
    }
    this.buf[i] = value;
  }
}
class LineIndex {
  /**
   * The id -> slot table. It outlives {@link free}: the write pass still needs
   * it to find the groups of each line.
   */
  slots = new IdSlots();
  /** Every id that has a line, ascending. Available after {@link finalize}. */
  ids = [];
  _typeIntern = /* @__PURE__ */ new Map();
  specialRaws = /* @__PURE__ */ new Map();
  // Per-slot storage
  _ids = [];
  _types = [];
  _refStart = new GrowableUint32();
  _refLen = new GrowableUint32();
  // Ids fit 32 bits in practice, so that is how references are stored until a
  // file proves otherwise; see `widenRefBuf`.
  _refBuf = new Uint32Array(4 * 1024 * 1024);
  _refBufUsed = 0;
  set(id, type, refs, raw) {
    if (!Number.isSafeInteger(id)) {
      throw new RangeError(
        `IFC id in "${raw.slice(0, 40)}" exceeds the largest id the splitter can represent (${Number.MAX_SAFE_INTEGER})`
      );
    }
    let t = this._typeIntern.get(type);
    if (!t) {
      t = type;
      this._typeIntern.set(type, t);
    }
    const slot = this.slots.add(id);
    this._ids[slot] = id;
    this._types[slot] = t;
    const start = this._refBufUsed;
    const needed = start + refs.length;
    if (needed > this._refBuf.length) {
      const newSize = Math.max(this._refBuf.length * 2, needed);
      const newBuf = this._refBuf instanceof Uint32Array ? new Uint32Array(newSize) : new Float64Array(newSize);
      newBuf.set(this._refBuf);
      this._refBuf = newBuf;
    }
    for (let i = 0; i < refs.length; i++) {
      if (refs[i] > 4294967295) this.widenRefBuf();
      this._refBuf[start + i] = refs[i];
    }
    this._refBufUsed = start + refs.length;
    this._refStart.set(slot, start);
    this._refLen.set(slot, refs.length);
    if (t.startsWith("IFCREL") || t === "IFCSTYLEDITEM" || t === "IFCMATERIALDEFINITIONREPRESENTATION") {
      this.specialRaws.set(id, raw);
    }
  }
  /**
   * Switches reference storage to doubles the first time a reference does not
   * fit 32 bits, instead of letting it wrap. Files that never do it keep
   * paying four bytes per reference.
   */
  widenRefBuf() {
    if (this._refBuf instanceof Float64Array) return;
    const wide = new Float64Array(this._refBuf.length);
    wide.set(this._refBuf);
    this._refBuf = wide;
  }
  finalize() {
    this._refBuf = this._refBuf.slice(0, this._refBufUsed);
    const ids = this._ids;
    let sorted = true;
    for (let i = 1; i < ids.length && sorted; i++) {
      sorted = ids[i - 1] < ids[i];
    }
    this.ids = sorted ? ids : Float64Array.from(ids).sort();
  }
  has(id) {
    return this.slots.get(id) >= 0;
  }
  getType(id) {
    const slot = this.slots.get(id);
    return slot < 0 ? void 0 : this._types[slot];
  }
  getRefs(id) {
    const slot = this.slots.get(id);
    if (slot < 0) return null;
    const start = this._refStart.get(slot);
    return this._refBuf.subarray(start, start + this._refLen.get(slot));
  }
  getRaw(id) {
    return this.specialRaws.get(id);
  }
  getAll(types) {
    const allElementIds = /* @__PURE__ */ new Set();
    for (const id of this.ids) {
      const type = this.getType(id);
      if (type && types.has(type)) allElementIds.add(id);
    }
    return allElementIds;
  }
  free() {
    this.ids = null;
    this._ids = null;
    this._types = null;
    this._refBuf = null;
    this._refStart = null;
    this._refLen = null;
    this.specialRaws = null;
  }
}
function collectDeps(startId, index, visited, allElementIds) {
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    const refs = index.getRefs(id);
    if (!refs) continue;
    visited.add(id);
    for (let i = 0; i < refs.length; i++) {
      const refId = refs[i];
      if (visited.has(refId)) continue;
      if (allElementIds.has(refId)) continue;
      stack.push(refId);
    }
  }
}
function collectDepsAll(startId, index, visited) {
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    const refs = index.getRefs(id);
    if (!refs) continue;
    visited.add(id);
    for (let i = 0; i < refs.length; i++) {
      if (!visited.has(refs[i])) stack.push(refs[i]);
    }
  }
}
function buildVoidFillMap(index) {
  const wallToOpenings = /* @__PURE__ */ new Map();
  const openingToWall = /* @__PURE__ */ new Map();
  const openingToFillers = /* @__PURE__ */ new Map();
  const fillerToOpening = /* @__PURE__ */ new Map();
  const relLineIds = /* @__PURE__ */ new Map();
  for (const id of index.ids) {
    const type = index.getType(id);
    if (!type) continue;
    if (type === "IFCRELVOIDSELEMENT") {
      const raw = index.getRaw(id);
      const argsStr = extractArgsString(raw);
      if (argsStr) {
        const args = splitIfcArgs(argsStr);
        if (args.length >= 6) {
          const wallId = parseHashRef(args[4]);
          const openingId = parseHashRef(args[5]);
          if (wallId && openingId) {
            if (!wallToOpenings.has(wallId))
              wallToOpenings.set(wallId, /* @__PURE__ */ new Set());
            wallToOpenings.get(wallId).add(openingId);
            openingToWall.set(openingId, wallId);
            addToSetMap(relLineIds, wallId, id);
            addToSetMap(relLineIds, openingId, id);
          }
        }
      }
    } else if (type === "IFCRELFILLSELEMENT") {
      const raw = index.getRaw(id);
      const argsStr = extractArgsString(raw);
      if (argsStr) {
        const args = splitIfcArgs(argsStr);
        if (args.length >= 6) {
          const openingId = parseHashRef(args[4]);
          const fillerId = parseHashRef(args[5]);
          if (openingId && fillerId) {
            if (!openingToFillers.has(openingId))
              openingToFillers.set(openingId, /* @__PURE__ */ new Set());
            openingToFillers.get(openingId).add(fillerId);
            fillerToOpening.set(fillerId, openingId);
            addToSetMap(relLineIds, openingId, id);
            addToSetMap(relLineIds, fillerId, id);
          }
        }
      }
    }
  }
  return {
    wallToOpenings,
    openingToWall,
    openingToFillers,
    fillerToOpening,
    relLineIds
  };
}
function buildAggregateMap(index, allElementIds) {
  const parentToChildren = /* @__PURE__ */ new Map();
  const childToParent = /* @__PURE__ */ new Map();
  const aggregateRelIds = /* @__PURE__ */ new Map();
  for (const id of index.ids) {
    const type = index.getType(id);
    if (type !== "IFCRELAGGREGATES") continue;
    const raw = index.getRaw(id);
    const argsStr = extractArgsString(raw);
    if (!argsStr) continue;
    const args = splitIfcArgs(argsStr);
    if (args.length < 6) continue;
    const parentId = parseHashRef(args[4]);
    if (!parentId || !allElementIds.has(parentId)) continue;
    const childRefs = extractRefs(args[5]);
    const elementChildren = childRefs.filter((r) => allElementIds.has(r));
    if (elementChildren.length === 0) continue;
    if (!parentToChildren.has(parentId))
      parentToChildren.set(parentId, /* @__PURE__ */ new Set());
    for (const cid of elementChildren) {
      parentToChildren.get(parentId).add(cid);
      childToParent.set(cid, parentId);
      addToSetMap(aggregateRelIds, parentId, id);
      addToSetMap(aggregateRelIds, cid, id);
    }
  }
  return { parentToChildren, childToParent, aggregateRelIds };
}
function traverseSpatialStructure(index, spatialTypes) {
  const spatialIds = /* @__PURE__ */ new Set();
  for (const id of index.ids) {
    const type = index.getType(id);
    if (type && spatialTypes.has(type)) spatialIds.add(id);
  }
  const sharedIds = /* @__PURE__ */ new Set();
  for (const sid of spatialIds) {
    collectDepsAll(sid, index, sharedIds);
  }
  for (const id of index.ids) {
    const type = index.getType(id);
    if (type === "IFCRELAGGREGATES") {
      const raw = index.getRaw(id);
      const argsStr = extractArgsString(raw);
      if (argsStr) {
        const args = splitIfcArgs(argsStr);
        if (args.length >= 6) {
          const relatingId = parseHashRef(args[4]);
          if (relatingId && spatialIds.has(relatingId)) {
            const listRefs = extractRefs(args[5]);
            if (listRefs.every((r) => spatialIds.has(r))) {
              collectDepsAll(id, index, sharedIds);
            }
          }
        }
      }
    }
  }
  return sharedIds;
}
function addToSetMap(map, key, value) {
  if (!map.has(key)) map.set(key, /* @__PURE__ */ new Set());
  map.get(key).add(value);
}
function getCluster(elementId, vfMap, aggMap) {
  const cluster = /* @__PURE__ */ new Set([elementId]);
  const queue = [elementId];
  while (queue.length > 0) {
    const eid = queue.shift();
    expandVoidFill(eid, vfMap, cluster, queue);
    expandAggregate(eid, aggMap, cluster, queue);
  }
  return cluster;
}
function expandVoidFill(eid, vfMap, cluster, queue) {
  function addIfNew(id) {
    if (!cluster.has(id)) {
      cluster.add(id);
      queue.push(id);
    }
  }
  const openings = vfMap.wallToOpenings.get(eid);
  if (openings) {
    for (const oid of openings) {
      addIfNew(oid);
      const fillers = vfMap.openingToFillers.get(oid);
      if (fillers) for (const fid of fillers) addIfNew(fid);
    }
  }
  const oid2 = vfMap.fillerToOpening.get(eid);
  if (oid2) {
    addIfNew(oid2);
    const wallId = vfMap.openingToWall.get(oid2);
    if (wallId) addIfNew(wallId);
  }
  const wallId2 = vfMap.openingToWall.get(eid);
  if (wallId2) addIfNew(wallId2);
}
function expandAggregate(eid, aggMap, cluster, queue) {
  function addIfNew(id) {
    if (!cluster.has(id)) {
      cluster.add(id);
      queue.push(id);
    }
  }
  const children = aggMap.parentToChildren.get(eid);
  if (children) {
    for (const cid of children) addIfNew(cid);
  }
  const parentId = aggMap.childToParent.get(eid);
  if (parentId) {
    addIfNew(parentId);
    const siblings = aggMap.parentToChildren.get(parentId);
    if (siblings) {
      for (const sid of siblings) addIfNew(sid);
    }
  }
}
function buildStyleMaps(index) {
  const geomToStyledItems = /* @__PURE__ */ new Map();
  const materialToDefReps = /* @__PURE__ */ new Map();
  for (const id of index.ids) {
    const type = index.getType(id);
    if (!type) continue;
    if (type === "IFCSTYLEDITEM") {
      const raw = index.getRaw(id);
      const argsStr = extractArgsString(raw);
      if (!argsStr) continue;
      const args = splitIfcArgs(argsStr);
      if (args.length >= 1) {
        const geomRef = parseHashRef(args[0]);
        if (geomRef) {
          if (!geomToStyledItems.has(geomRef))
            geomToStyledItems.set(geomRef, []);
          geomToStyledItems.get(geomRef).push(id);
        }
      }
    } else if (type === "IFCMATERIALDEFINITIONREPRESENTATION") {
      const raw = index.getRaw(id);
      const argsStr = extractArgsString(raw);
      if (!argsStr) continue;
      const args = splitIfcArgs(argsStr);
      if (args.length >= 4) {
        const matRef = parseHashRef(args[3]);
        if (matRef) {
          if (!materialToDefReps.has(matRef)) materialToDefReps.set(matRef, []);
          materialToDefReps.get(matRef).push(id);
        }
      }
    }
  }
  return { geomToStyledItems, materialToDefReps };
}
function resolveStyles(fileIds, index, styleMaps, allElementIds) {
  for (const [geomId, styledItemIds] of styleMaps.geomToStyledItems) {
    if (fileIds.has(geomId)) {
      for (const sid of styledItemIds) {
        collectDeps(sid, index, fileIds, allElementIds);
      }
    }
  }
  for (const [matId, defRepIds] of styleMaps.materialToDefReps) {
    if (fileIds.has(matId)) {
      for (const mid of defRepIds) {
        collectDeps(mid, index, fileIds, allElementIds);
      }
    }
  }
}
class IdGroupIndex {
  starts;
  members;
  slots;
  constructor(groupsData, slots) {
    const starts = new Uint32Array(slots.size + 1);
    let total = 0;
    for (const groupData of groupsData) {
      for (const id of groupData.fileIds) {
        const slot = slots.get(id);
        if (slot < 0) continue;
        starts[slot + 1] += 1;
        total += 1;
      }
    }
    for (let i = 1; i < starts.length; i++) starts[i] += starts[i - 1];
    const members = new Uint32Array(total);
    const cursor = starts.slice();
    for (let g = 0; g < groupsData.length; g++) {
      for (const id of groupsData[g].fileIds) {
        const slot = slots.get(id);
        if (slot < 0) continue;
        members[cursor[slot]] = g;
        cursor[slot] += 1;
      }
    }
    this.starts = starts;
    this.members = members;
    this.slots = slots;
  }
  /**
   * Positions in `groupsData` of the groups that include `id`, ascending.
   * Empty if none.
   */
  groupsOf(id) {
    const slot = this.slots.get(id);
    if (slot < 0) return new Uint32Array(0);
    return this.members.subarray(this.starts[slot], this.starts[slot + 1]);
  }
}
async function emitSplitLine(writers, raw, groupsData, idGroups) {
  if (raw.charCodeAt(0) !== 35) return;
  let id = 0;
  for (let i = 1; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      id = id * 10 + (c - 48);
    } else {
      break;
    }
  }
  if (id === 0) return;
  const groups = idGroups.groupsOf(id);
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const line = groupsData[g].rewrittenLines.get(id) ?? raw;
    await writers[g].write(`${line}
`);
  }
}
async function emitExtractLine(writer, raw, includeSet, rewrittenLines) {
  if (raw.charCodeAt(0) !== 35) return;
  let id = 0;
  for (let i = 1; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      id = id * 10 + (c - 48);
    } else {
      break;
    }
  }
  if (id === 0 || !includeSet.has(id)) return;
  const line = rewrittenLines.get(id) ?? raw;
  await writer.write(`${line}
`);
}
async function abortWriters(writers, reason) {
  await Promise.allSettled(writers.map(async (writer) => writer.abort(reason)));
}
class IfcSplitter {
  io;
  config;
  eventTarget;
  /**
   * @param ifcSplitterIO - How to read the input file and write the output
   * files.
   * @param config - Which IFC types to treat as elements and spatial structure,
   * and how to read relationship lists. Defaults apply to anything left out.
   */
  constructor(ifcSplitterIO, config = {}) {
    this.io = ifcSplitterIO;
    this.config = {
      elementTypes: new Set(config.elementTypes ?? ELEMENT_TYPES),
      spatialTypes: new Set(config.spatialTypes ?? SPATIAL_TYPES),
      listArgIndex: config.listArgIndex ?? listIdxByType
    };
    this.eventTarget = new EventTarget();
  }
  /**
   * Fires from `split` and `extract` each time a stage finishes, with the time
   * it took.
   */
  onProgress = new Event();
  /**
   * Fires from `split` once the content of every output file is resolved, just
   * before the files are written.
   */
  onSplitsResolved = new Event();
  /**
   * Fires from `extract` when an id is missing or has a wrong type
   */
  onExtractWarning = new Event();
  /**
   * Split an IFC file into N roughly equal groups of building elements.
   *
   * Each output file is a valid IFC containing its share of elements plus all
   * shared infrastructure (spatial structure, geometry, materials, properties).
   * Coupled elements (wall + opening + door, roof + slabs) are kept together.
   *
   * @param inputPath - Absolute or relative path to the source IFC file.
   * @param numGroups - Number of output files to produce. Not capped by the
   * splitter, but note that the write pass holds one open writer per non-empty
   * group, so the practical ceiling is the process' file descriptor limit.
   * @param outputPath - Given `groupId` returns output file path.
   * @returns a map keyed by {@link GroupData.groupId} with the path of each
   * written file and the IFC ids it contains. Empty groups have no entry.
   * @throws {RangeError} if `numGroups` is not a positive integer.
   */
  async split(inputPath, numGroups, outputPath) {
    if (!Number.isInteger(numGroups) || numGroups < 1) {
      throw new RangeError(
        `numGroups must be a positive integer, received ${numGroups}`
      );
    }
    const parseStart = performance.now();
    const { header, footer, index } = await this.parseIfc(inputPath);
    this.emitProgressEvent("parse", parseStart);
    const spatialStart = performance.now();
    const sharedIds = traverseSpatialStructure(index, this.config.spatialTypes);
    this.emitProgressEvent("spatial", spatialStart);
    const voidFillStart = performance.now();
    const vfMap = buildVoidFillMap(index);
    this.emitProgressEvent("void-fill", voidFillStart);
    const styleMapsStart = performance.now();
    const styleMaps = buildStyleMaps(index);
    this.emitProgressEvent("style-maps", styleMapsStart);
    const classifyStart = performance.now();
    const allElementIds = index.getAll(this.config.elementTypes);
    this.emitProgressEvent("classify", classifyStart);
    const aggregateStart = performance.now();
    const aggMap = buildAggregateMap(index, allElementIds);
    this.emitProgressEvent("aggregate", aggregateStart);
    const clusterStart = performance.now();
    const clusters = [];
    const assigned = /* @__PURE__ */ new Set();
    for (const eid of allElementIds) {
      if (assigned.has(eid)) continue;
      const cluster = getCluster(eid, vfMap, aggMap);
      const elementCluster = /* @__PURE__ */ new Set();
      for (const cid of cluster) {
        if (allElementIds.has(cid)) {
          elementCluster.add(cid);
          assigned.add(cid);
        }
      }
      clusters.push(elementCluster);
    }
    assigned.clear();
    this.emitProgressEvent("cluster", clusterStart);
    const distributeStart = performance.now();
    const groups = Array.from(
      { length: numGroups },
      () => /* @__PURE__ */ new Set()
    );
    const clusterOrder = clusters.map((_, i) => i).sort((a, b) => clusters[b].size - clusters[a].size);
    const groupSizes = new Array(numGroups).fill(0);
    for (const ci of clusterOrder) {
      let minIdx = 0;
      for (let g = 1; g < numGroups; g++) {
        if (groupSizes[g] < groupSizes[minIdx]) minIdx = g;
      }
      for (const id of clusters[ci]) groups[minIdx].add(id);
      groupSizes[minIdx] += clusters[ci].size;
    }
    this.emitProgressEvent("distribute", distributeStart);
    const relationsStart = performance.now();
    const relEntries = [];
    for (const id of index.ids) {
      const type = index.getType(id);
      if (type && shouldRewriteType(type)) {
        const raw = index.getRaw(id);
        const argsStr = extractArgsString(raw);
        if (!argsStr) continue;
        const args = splitIfcArgs(argsStr);
        const listIdx = this.config.listArgIndex(type) ?? -1;
        if (listIdx < 0 || args.length <= listIdx) continue;
        const listRefs = extractRefs(args[listIdx]);
        if (listRefs.length === 0) continue;
        const idMatch = raw.match(/^(#\d+\s*=\s*)/);
        if (!idMatch) continue;
        relEntries.push({
          id,
          type,
          args,
          listIdx,
          listRefs,
          idPrefix: idMatch[1]
        });
      }
    }
    this.emitProgressEvent("relations", relationsStart);
    const resolveStart = performance.now();
    const groupsData = [];
    for (let g = 0; g < numGroups; g++) {
      const groupElementIds = groups[g];
      if (groupElementIds.size === 0) continue;
      const fileIds = new Set(sharedIds);
      for (const eid of groupElementIds) {
        collectDeps(eid, index, fileIds, allElementIds);
      }
      for (const eid of groupElementIds) {
        const rels = vfMap.relLineIds.get(eid);
        if (rels) {
          for (const rid of rels) {
            collectDeps(rid, index, fileIds, allElementIds);
          }
        }
        const aggRels = aggMap.aggregateRelIds.get(eid);
        if (aggRels) {
          for (const rid of aggRels) {
            collectDeps(rid, index, fileIds, allElementIds);
          }
        }
      }
      resolveStyles(fileIds, index, styleMaps, allElementIds);
      const rewrittenLines = /* @__PURE__ */ new Map();
      for (const rel of relEntries) {
        const filtered = rel.listRefs.filter((r) => groupElementIds.has(r));
        if (filtered.length === 0) continue;
        const newList = `(${filtered.map((r) => `#${r}`).join(",")})`;
        const newArgs = [...rel.args];
        newArgs[rel.listIdx] = newList;
        const rewritten = `${rel.idPrefix}${rel.type}(${newArgs.join(",")});`;
        rewrittenLines.set(rel.id, rewritten);
        fileIds.add(rel.id);
        const refs = index.getRefs(rel.id);
        if (refs) {
          for (const rid of refs) {
            if (!allElementIds.has(rid)) {
              collectDeps(rid, index, fileIds, allElementIds);
            }
          }
        }
      }
      const totalIds = fileIds.size;
      groupsData.push({
        groupId: g,
        fileIds,
        rewrittenLines,
        elementCount: groupElementIds.size,
        totalIds,
        filePath: outputPath(g)
      });
    }
    this.emitProgressEvent("resolve", resolveStart);
    this.onSplitsResolved.trigger({ data: groupsData });
    index.free();
    const buildIndexStart = performance.now();
    const idGroups = new IdGroupIndex(groupsData, index.slots);
    this.emitProgressEvent("build-index", buildIndexStart);
    const writeStart = performance.now();
    await this.writeSplitOutput(
      inputPath,
      header,
      footer,
      groupsData,
      idGroups
    );
    this.emitProgressEvent("write", writeStart);
    return new Map(
      groupsData.map(({ groupId, filePath, fileIds }) => [
        groupId,
        { path: filePath, ids: fileIds }
      ])
    );
  }
  /**
   * Extract specific building elements from an IFC file into a new IFC file.
   *
   * Produces a single valid IFC containing only the requested elements and all
   * of their dependencies (geometry, materials, styles, property sets).
   * Void/fill coupling (wall + opening + door/window) and aggregation
   * (roof + slabs, stair + flights) are automatically expanded so the output
   * stays structurally consistent.
   *
   * @param inputPath  - Absolute or relative path to the source IFC file.
   * @param elementIds - Array of IFC entity IDs (`#id`) for the building elements to extract. Non-element or missing IDs are skipped, each reported through {@link onExtractWarning}.
   * @param outputPath - Path for the output IFC file.
   * @returns the IFC ids written to the output file.
   * @throws {Error} if none of `elementIds` resolves to a building element. No
   * output file is produced in that case.
   */
  async extract(inputPath, elementIds, outputPath) {
    const parseStart = performance.now();
    const { header, footer, index } = await this.parseIfc(inputPath);
    this.emitProgressEvent("parse", parseStart);
    const spatialStart = performance.now();
    const sharedIds = traverseSpatialStructure(index, this.config.spatialTypes);
    this.emitProgressEvent("spatial", spatialStart);
    const voidFillStart = performance.now();
    const vfMap = buildVoidFillMap(index);
    this.emitProgressEvent("void-fill", voidFillStart);
    const styleMapsStart = performance.now();
    const styleMaps = buildStyleMaps(index);
    this.emitProgressEvent("style-maps", styleMapsStart);
    const classifyStart = performance.now();
    const allElementIds = index.getAll(this.config.elementTypes);
    this.emitProgressEvent("classify", classifyStart);
    const aggregateStart = performance.now();
    const aggMap = buildAggregateMap(index, allElementIds);
    this.emitProgressEvent("aggregate", aggregateStart);
    const clusterStart = performance.now();
    const requestedIds = /* @__PURE__ */ new Set();
    for (const eid of elementIds) {
      if (allElementIds.has(eid)) {
        requestedIds.add(eid);
      } else if (index.has(eid)) {
        const type = index.getType(eid);
        this.onExtractWarning.trigger({
          message: `Skipping #${eid}: type '${type}' is not a building element`,
          context: { id: eid, type }
        });
      } else {
        this.onExtractWarning.trigger({
          message: `Skipping #${eid}: not found`,
          context: { id: eid }
        });
      }
    }
    if (requestedIds.size === 0) {
      throw new Error("No valid element IDs found.");
    }
    const groupElementIds = new Set(requestedIds);
    for (const eid of requestedIds) {
      const cluster = getCluster(eid, vfMap, aggMap);
      for (const cid of cluster) {
        if (allElementIds.has(cid)) groupElementIds.add(cid);
      }
    }
    this.emitProgressEvent("cluster", clusterStart);
    const relationsStart = performance.now();
    const fileIds = new Set(sharedIds);
    const rewrittenLines = /* @__PURE__ */ new Map();
    for (const id of index.ids) {
      const type = index.getType(id);
      if (type && shouldRewriteType(type)) {
        const raw = index.getRaw(id);
        const argsStr = extractArgsString(raw);
        if (!argsStr) continue;
        const args = splitIfcArgs(argsStr);
        const listIdx = this.config.listArgIndex(type) ?? -1;
        if (listIdx < 0 || args.length <= listIdx) continue;
        const listRefs = extractRefs(args[listIdx]);
        if (listRefs.length === 0) continue;
        const filtered = listRefs.filter((r) => groupElementIds.has(r));
        if (filtered.length === 0) continue;
        const idMatch = raw.match(/^(#\d+\s*=\s*)/);
        if (!idMatch) continue;
        const newList = `(${filtered.map((r) => `#${r}`).join(",")})`;
        const newArgs = [...args];
        newArgs[listIdx] = newList;
        rewrittenLines.set(id, `${idMatch[1]}${type}(${newArgs.join(",")});`);
        fileIds.add(id);
        const refs = index.getRefs(id);
        if (refs) {
          for (const rid of refs) {
            if (!allElementIds.has(rid))
              collectDeps(rid, index, fileIds, allElementIds);
          }
        }
      }
    }
    this.emitProgressEvent("relations", relationsStart);
    const resolveStart = performance.now();
    for (const eid of groupElementIds) {
      collectDeps(eid, index, fileIds, allElementIds);
    }
    for (const eid of groupElementIds) {
      const rels = vfMap.relLineIds.get(eid);
      if (rels) {
        for (const rid of rels) collectDeps(rid, index, fileIds, allElementIds);
      }
      const aggRels = aggMap.aggregateRelIds.get(eid);
      if (aggRels) {
        for (const rid of aggRels)
          collectDeps(rid, index, fileIds, allElementIds);
      }
    }
    resolveStyles(fileIds, index, styleMaps, allElementIds);
    this.emitProgressEvent("resolve", resolveStart);
    index.free();
    const writeStart = performance.now();
    const writer = (await this.io.writableStream(outputPath)).getWriter();
    let closed = false;
    try {
      await writer.write(`${header.join("\n")}
`);
      let section = "header";
      let accumulator = "";
      await this.forEachLine(inputPath, async (line) => {
        if (section === "header") {
          if (line.trim() === "DATA;") section = "data";
          return;
        }
        if (section === "data") {
          const trimmed = line.trim();
          if (trimmed === "ENDSEC;") {
            if (accumulator) {
              await emitExtractLine(
                writer,
                accumulator,
                fileIds,
                rewrittenLines
              );
              accumulator = "";
            }
            section = "footer";
            return;
          }
          if (!accumulator && trimmed.charCodeAt(trimmed.length - 1) === 59) {
            await emitExtractLine(writer, trimmed, fileIds, rewrittenLines);
            return;
          }
          accumulator += (accumulator ? " " : "") + trimmed;
          if (accumulator.charCodeAt(accumulator.length - 1) === 59) {
            await emitExtractLine(writer, accumulator, fileIds, rewrittenLines);
            accumulator = "";
          }
        }
      });
      await writer.write(`${footer.join("\n")}
`);
      await writer.close();
      closed = true;
    } finally {
      if (!closed) await abortWriters([writer]);
    }
    this.emitProgressEvent("write", writeStart);
    return fileIds;
  }
  /**
   * Reads an IFC file into its header lines, footer lines and an index of
   * every data line by id. This is the first stage of `split` and `extract`.
   * @param filePath - Path of the IFC file, read through the
   * {@link IfcSplitterIO}.
   */
  async parseIfc(filePath) {
    const header = [];
    const footer = [];
    const index = new LineIndex();
    let section = "header";
    let accumulator = "";
    await this.forEachLine(filePath, (line) => {
      if (section === "header") {
        header.push(line);
        if (line.trim() === "DATA;") section = "data";
        return;
      }
      if (section === "data") {
        const trimmed = line.trim();
        if (trimmed === "ENDSEC;") {
          if (accumulator) {
            const info = extractLineMeta(accumulator);
            if (info) {
              const refs = extractRefs(accumulator, info.id);
              index.set(info.id, info.type, refs, accumulator);
            }
            accumulator = "";
          }
          section = "footer";
          footer.push(line);
          return;
        }
        accumulator += (accumulator ? " " : "") + trimmed;
        if (accumulator.charCodeAt(accumulator.length - 1) === 59) {
          const info = extractLineMeta(accumulator);
          if (info) {
            const refs = extractRefs(accumulator, info.id);
            index.set(info.id, info.type, refs, accumulator);
          }
          accumulator = "";
        }
        return;
      }
      footer.push(line);
    });
    index.finalize();
    return { header, footer, index };
  }
  /**
   * Chunked file reader — replaces readline (3-5x faster)
   * @param filePath - Path of the file, read through the {@link IfcSplitterIO}.
   * @param callback - Called with each line, awaited before the next one.
   */
  async forEachLine(filePath, callback) {
    const readableStream = await this.io.readableStream(filePath);
    for await (const line of streamAsyncIterator(readableStream)) {
      await callback(line);
    }
  }
  async writeSplitOutput(inputPath, header, footer, groupsData, idGroups) {
    const headerStr = `${header.join("\n")}
`;
    const writers = await this.openGroupWriters(groupsData, headerStr);
    let section = "header";
    let accumulator = "";
    let closed = false;
    try {
      await this.forEachLine(inputPath, async (line) => {
        if (section === "header") {
          if (line.trim() === "DATA;") section = "data";
          return;
        }
        if (section === "data") {
          const trimmed = line.trim();
          if (trimmed === "ENDSEC;") {
            if (accumulator) {
              await emitSplitLine(writers, accumulator, groupsData, idGroups);
              accumulator = "";
            }
            section = "footer";
            return;
          }
          if (!accumulator && trimmed.charCodeAt(trimmed.length - 1) === 59) {
            await emitSplitLine(writers, trimmed, groupsData, idGroups);
            return;
          }
          accumulator += (accumulator ? " " : "") + trimmed;
          if (accumulator.charCodeAt(accumulator.length - 1) === 59) {
            await emitSplitLine(writers, accumulator, groupsData, idGroups);
            accumulator = "";
          }
        }
      });
      const footerStr = `${footer.join("\n")}
`;
      await Promise.all(
        writers.map(async (writer) => {
          await writer.write(footerStr);
          await writer.close();
        })
      );
      closed = true;
    } finally {
      if (!closed) await abortWriters(writers);
    }
  }
  /**
   * Open one writer per non-empty group and prime it with the header. If any
   * writer fails to open, the ones already opened are aborted before rethrowing.
   */
  async openGroupWriters(groupsData, headerStr) {
    const settled = await Promise.allSettled(
      groupsData.map(async (groupData) => {
        const writer = (await this.io.writableStream(groupData.filePath)).getWriter();
        await writer.write(headerStr);
        return writer;
      })
    );
    const opened = settled.flatMap(
      (result) => result.status === "fulfilled" ? [result.value] : []
    );
    const failure = settled.find(
      (result) => result.status === "rejected"
    );
    if (failure) {
      await abortWriters(opened, failure.reason);
      throw failure.reason;
    }
    return opened;
  }
  emitProgressEvent(stage, start) {
    this.onProgress.trigger({
      stage,
      timeElapsed: performance.now() - start
    });
  }
}
export {
  ELEMENT_TYPES,
  IfcSplitter,
  SPATIAL_TYPES,
  listIdxByType
};
//# sourceMappingURL=index.mjs.map
