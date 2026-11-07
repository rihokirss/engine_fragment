class Clothoid {
  core;
  constructor(api) {
    this.core = api.CreateClothoid();
  }
  get(data) {
    const start = data.startPoint ?? [0, 0, 0];
    const startDir = data.startDirection ?? 0.5;
    const segments = data.segments ?? 12;
    const startRadius = data.startRadius ?? 5;
    const endRadius = data.endRadius ?? 0;
    const segmentLength = data.segmentLength ?? 5;
    const [startX, startY, startZ] = start;
    this.core.SetValues(
      segments,
      startX,
      startY,
      startZ,
      startDir,
      startRadius,
      endRadius,
      segmentLength
    );
    return this.core.GetBuffers();
  }
}
export {
  Clothoid
};
//# sourceMappingURL=clothoid.mjs.map
