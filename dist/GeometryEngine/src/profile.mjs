import * as THREE from "three";
var ProfileType = /* @__PURE__ */ ((ProfileType2) => {
  ProfileType2[ProfileType2["H"] = 0] = "H";
  ProfileType2[ProfileType2["C"] = 1] = "C";
  ProfileType2[ProfileType2["Z"] = 2] = "Z";
  ProfileType2[ProfileType2["T"] = 3] = "T";
  ProfileType2[ProfileType2["L"] = 4] = "L";
  return ProfileType2;
})(ProfileType || {});
class Profile {
  core;
  static map = /* @__PURE__ */ new Map([
    [
      "H",
      0
      /* H */
    ],
    [
      "C",
      1
      /* C */
    ],
    [
      "Z",
      2
      /* Z */
    ],
    [
      "T",
      3
      /* T */
    ],
    [
      "L",
      4
      /* L */
    ]
  ]);
  constructor(api) {
    this.core = api.CreateProfile();
  }
  get(api, data) {
    const type = data.type ?? 0;
    const width = data.width ?? 0.2;
    const depth = data.depth ?? 0.2;
    const thickness = data.thickness ?? 2e-3;
    const flangeThickness = data.flangeThickness ?? 2e-3;
    const hasFillet = data.hasFillet ?? false;
    const filletRadius = data.filletRadius ?? 1e-3;
    const radius = data.radius ?? 0.01;
    const slope = data.slope ?? 1e-3;
    const circleSegments = data.circleSegments ?? 20;
    const formattedPlacement = new api.wasmModule.DoubleVector();
    const mat = data.placement ?? new THREE.Matrix4().identity();
    for (const element of mat.elements) {
      formattedPlacement.push_back(element);
    }
    const core = this.core;
    core.SetValues(
      type,
      width,
      depth,
      thickness,
      flangeThickness,
      hasFillet,
      filletRadius,
      radius,
      slope,
      circleSegments,
      // @ts-ignore
      formattedPlacement
    );
    return core.GetBuffers();
  }
}
export {
  Profile,
  ProfileType
};
//# sourceMappingURL=profile.mjs.map
