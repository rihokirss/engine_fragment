import { Sample } from "../../Schema/sample.mjs";
function buildSample(builder, localIdToIndex, itemId, matId, reprId, ltId) {
  if (!localIdToIndex.has(itemId)) {
    throw new Error("Invalid sample: item id not found");
  }
  if (!localIdToIndex.has(matId)) {
    throw new Error("Invalid sample: mat id not found");
  }
  if (!localIdToIndex.has(reprId)) {
    throw new Error("Invalid sample: repr id not found");
  }
  if (!localIdToIndex.has(ltId)) {
    throw new Error("Invalid sample: lt id not found");
  }
  const itemIndex = localIdToIndex.get(itemId);
  const matIndex = localIdToIndex.get(matId);
  const reprIndex = localIdToIndex.get(reprId);
  const ltIndex = localIdToIndex.get(ltId);
  Sample.createSample(builder, itemIndex, matIndex, reprIndex, ltIndex);
}
export {
  buildSample
};
//# sourceMappingURL=sample-functions.mjs.map
