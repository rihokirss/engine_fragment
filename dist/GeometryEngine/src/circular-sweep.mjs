class CircularSweep {
  core;
  constructor(api) {
    this.core = api.CreateCircularSweep();
  }
  get(api, data) {
    const doubleProfilePoints = new api.wasmModule.DoubleVector();
    const profilePoints = data.profilePoints ?? [];
    for (const p of profilePoints) {
      doubleProfilePoints.push_back(p);
    }
    const doubleDirPoint = new api.wasmModule.DoubleVector();
    const directrix = data.directrix ?? [];
    for (const p of directrix) {
      doubleDirPoint.push_back(p);
    }
    const doubleInitNormal = new api.wasmModule.DoubleVector();
    const initNormal = data.initNormal ?? [0, 0, 0];
    for (const p of initNormal) {
      doubleInitNormal.push_back(p);
    }
    const scale = data.scale ?? 1;
    const closed = data.closed ?? false;
    const radius = data.radius ?? 10;
    const rotate = data.rotate ?? false;
    this.core.SetValues(
      scale,
      closed,
      doubleProfilePoints,
      radius,
      doubleDirPoint,
      doubleInitNormal,
      rotate
    );
    return this.core.GetBuffers();
  }
}
export {
  CircularSweep
};
//# sourceMappingURL=circular-sweep.mjs.map
