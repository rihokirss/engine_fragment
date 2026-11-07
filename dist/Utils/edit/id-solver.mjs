import { isIndexRequest, EditRequestType } from "./edit-types.mjs";
import { solveSampleTempId, solveGtTempId, solveLocalIdTempId } from "./temp-id-solvers.mjs";
function solveIds(requests, nextId) {
  const tempIds = /* @__PURE__ */ new Map();
  const result = [];
  for (const request of requests) {
    if (isIndexRequest(request)) continue;
    if (request.localId !== void 0) {
      continue;
    }
    const newId = nextId++;
    if (request.tempId) {
      tempIds.set(request.tempId, newId);
    }
    request.localId = newId;
    result.push(newId);
  }
  for (const request of requests) {
    if (isIndexRequest(request)) continue;
    if (request.type === EditRequestType.UPDATE_SAMPLE || request.type === EditRequestType.CREATE_SAMPLE) {
      const sample = request.data;
      solveSampleTempId(sample, "item", tempIds);
      solveSampleTempId(sample, "material", tempIds);
      solveSampleTempId(sample, "representation", tempIds);
      solveSampleTempId(sample, "localTransform", tempIds);
      continue;
    }
    if (request.type === EditRequestType.UPDATE_GLOBAL_TRANSFORM || request.type === EditRequestType.CREATE_GLOBAL_TRANSFORM) {
      const gt = request.data;
      solveGtTempId(gt, "itemId", tempIds);
      continue;
    }
    solveLocalIdTempId(request, "localId", tempIds);
  }
  tempIds.clear();
  return result;
}
export {
  solveIds
};
//# sourceMappingURL=id-solver.mjs.map
