import * as THREE from "three";
class Revolve {
  core;
  constructor(api) {
    this.core = api.CreateRevolution();
  }
  get(api, data) {
    const doubleProfile = new api.wasmModule.DoubleVector();
    const profile = data.profile ?? [];
    for (const p of profile) {
      doubleProfile.push_back(p);
    }
    const doubleTrans = new api.wasmModule.DoubleVector();
    const transform = data.transform ?? new THREE.Matrix4().identity().elements;
    for (const p of transform) {
      doubleTrans.push_back(p);
    }
    const start = data.start ?? 0;
    const end = data.end ?? 180;
    const count = data.segmentCount ?? 12;
    this.core.SetValues(doubleProfile, doubleTrans, start, end, count);
    return this.core.GetBuffers();
  }
}
export {
  Revolve
};
//# sourceMappingURL=revolve.mjs.map
