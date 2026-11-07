class Parabola {
  core;
  constructor(api) {
    this.core = api.CreateParabola();
  }
  get(data) {
    const segments = data.segmentCount ?? 12;
    const [x, y, z] = data.start ?? [0, 0, 0];
    const horLen = data.horizontalLength ?? 10;
    const startHeight = data.startHeight ?? 2;
    const startGrad = data.startGradient ?? 5;
    const endGrad = data.endGradient ?? 0;
    this.core.SetValues(
      segments,
      x,
      y,
      z,
      horLen,
      startHeight,
      startGrad,
      endGrad
    );
    return this.core.GetBuffers();
  }
}
export {
  Parabola
};
//# sourceMappingURL=parabola.mjs.map
