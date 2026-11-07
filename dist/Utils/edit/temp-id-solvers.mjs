function solveGtTempId(sample, key, tempIdsToLocalIds) {
  const value = sample[key];
  if (typeof value === "string") {
    const localId = tempIdsToLocalIds.get(value);
    if (localId === void 0) {
      throw new Error(`Malformed request: temp id ${sample[key]} not found`);
    }
    sample[key] = localId;
  }
}
function solveSampleTempId(sample, key, tempIdsToLocalIds) {
  const value = sample[key];
  if (typeof value === "string") {
    const localId = tempIdsToLocalIds.get(value);
    if (localId === void 0) {
      throw new Error(`Malformed request: temp id ${sample[key]} not found`);
    }
    sample[key] = localId;
  }
}
function solveLocalIdTempId(request, key, tempIdsToLocalIds) {
  const value = request[key];
  if (typeof value === "string") {
    const localId = tempIdsToLocalIds.get(value);
    if (localId === void 0) {
      throw new Error(`Malformed request: temp id ${request[key]} not found`);
    }
    request[key] = localId;
  }
}
export {
  solveGtTempId,
  solveLocalIdTempId,
  solveSampleTempId
};
//# sourceMappingURL=temp-id-solvers.mjs.map
