import { BufferAttribute } from "three";
function getVertexCount(geo) {
  return geo.index ? geo.index.count : geo.attributes.position.count;
}
function getTriCount(geo) {
  return getVertexCount(geo) / 3;
}
function getIndexArray(vertexCount, BufferConstructor = ArrayBuffer) {
  if (vertexCount > 65535) {
    return new Uint32Array(new BufferConstructor(4 * vertexCount));
  } else {
    return new Uint16Array(new BufferConstructor(2 * vertexCount));
  }
}
function ensureIndex(geo, options) {
  if (!geo.index) {
    const vertexCount = geo.attributes.position.count;
    const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
    const index = getIndexArray(vertexCount, BufferConstructor);
    geo.setIndex(new BufferAttribute(index, 1));
    for (let i = 0; i < vertexCount; i++) {
      index[i] = i;
    }
  }
}
function getFullPrimitiveRange(geo, range, stride) {
  const primitiveCount = getVertexCount(geo) / stride;
  const drawRange = range ? range : geo.drawRange;
  const start = drawRange.start / stride;
  const end = (drawRange.start + drawRange.count) / stride;
  const offset = Math.max(0, start);
  const count = Math.min(primitiveCount, end) - offset;
  return {
    offset: Math.floor(offset),
    count: Math.floor(count)
  };
}
function getPrimitiveGroupRanges(geo, stride) {
  return geo.groups.map((group) => ({
    offset: group.start / stride,
    count: group.count / stride
  }));
}
function getRootPrimitiveRanges(geo, range, stride) {
  const drawRange = getFullPrimitiveRange(geo, range, stride);
  const primitiveRanges = getPrimitiveGroupRanges(geo, stride);
  if (!primitiveRanges.length) {
    return [drawRange];
  }
  const ranges = [];
  const drawRangeStart = drawRange.offset;
  const drawRangeEnd = drawRange.offset + drawRange.count;
  const primitiveCount = getVertexCount(geo) / stride;
  const events = [];
  for (const group of primitiveRanges) {
    const { offset, count } = group;
    const groupStart = offset;
    const groupCount = isFinite(count) ? count : primitiveCount - offset;
    const groupEnd = offset + groupCount;
    if (groupStart < drawRangeEnd && groupEnd > drawRangeStart) {
      events.push({ pos: Math.max(drawRangeStart, groupStart), isStart: true });
      events.push({ pos: Math.min(drawRangeEnd, groupEnd), isStart: false });
    }
  }
  events.sort((a, b) => {
    if (a.pos !== b.pos) {
      return a.pos - b.pos;
    } else {
      return a.type === "end" ? -1 : 1;
    }
  });
  let activeGroups = 0;
  let lastPos = null;
  for (const event of events) {
    const newPos = event.pos;
    if (activeGroups !== 0 && newPos !== lastPos) {
      ranges.push({
        offset: lastPos,
        count: newPos - lastPos
      });
    }
    activeGroups += event.isStart ? 1 : -1;
    lastPos = newPos;
  }
  return ranges;
}
export {
  ensureIndex,
  getIndexArray,
  getRootPrimitiveRanges,
  getTriCount,
  getVertexCount
};
//# sourceMappingURL=geometryUtils.mjs.map
