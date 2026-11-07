class Extrusion {
  core;
  constructor(api) {
    this.core = api.CreateExtrusion();
  }
  get(api, data) {
    const inputProfilePoints = data.profilePoints ?? [
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      0
    ];
    const inputProfileHoles = data.profileHoles ?? [];
    const inputDirection = data.direction ?? [0, 0, 1];
    const inputCutPlaneNor = data.cuttingPlaneNormal ?? [0, 0, 0];
    const inputCutPlanePos = data.cuttingPlanePosition ?? [0, 0, 0];
    const inputLength = data.length ?? 1;
    const inputCap = data.cap ?? true;
    const profilePoints = new api.wasmModule.DoubleVector();
    for (const coord of inputProfilePoints) {
      profilePoints.push_back(coord);
    }
    for (const hole of inputProfileHoles) {
      const holeVector = new api.wasmModule.DoubleVector();
      for (const coord of hole) {
        holeVector.push_back(coord);
      }
      this.core.SetHoles(holeVector);
    }
    const dirPoint = new api.wasmModule.DoubleVector();
    for (const coord of inputDirection) {
      dirPoint.push_back(coord);
    }
    const cuttingPlaneNormal = new api.wasmModule.DoubleVector();
    for (const coord of inputCutPlaneNor) {
      cuttingPlaneNormal.push_back(coord);
    }
    const cuttingPlanePos = new api.wasmModule.DoubleVector();
    for (const coord of inputCutPlanePos) {
      cuttingPlanePos.push_back(coord);
    }
    this.core.SetValues(
      profilePoints,
      dirPoint,
      inputLength,
      cuttingPlaneNormal,
      cuttingPlanePos,
      inputCap
    );
    const result = this.core.GetBuffers();
    this.core.ClearHoles();
    return result;
  }
}
export {
  Extrusion
};
//# sourceMappingURL=extrusion.mjs.map
