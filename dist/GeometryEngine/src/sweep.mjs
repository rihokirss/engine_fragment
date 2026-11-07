class Sweep {
  core;
  constructor(api) {
    this.core = api.CreateSweep();
  }
  get(api, data) {
    const inputProfilePoints = data.profilePoints ?? [];
    const inputCurvePoints = data.curvePoints ?? [];
    const inputStartNormal = data.startNormal ?? [0, 0, 0];
    const scale = data.scale ?? 1;
    const close = data.close ?? false;
    const rotate90 = data.rotate90 ?? false;
    const optimize = data.optimize ?? false;
    const profilePoints = new api.wasmModule.DoubleVector();
    for (const p of inputProfilePoints) {
      profilePoints.push_back(p);
    }
    const dirPoint = new api.wasmModule.DoubleVector();
    for (const p of inputCurvePoints) {
      dirPoint.push_back(p);
    }
    const iniNormal = new api.wasmModule.DoubleVector();
    for (const p of inputStartNormal) {
      iniNormal.push_back(p);
    }
    this.core.SetValues(
      scale,
      close,
      profilePoints,
      dirPoint,
      iniNormal,
      rotate90,
      optimize
    );
    const result = this.core.GetBuffers();
    return result;
  }
}
export {
  Sweep
};
//# sourceMappingURL=sweep.mjs.map
