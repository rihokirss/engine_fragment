import * as THREE from "three";
import { LodHelper } from "./lod-helper.mjs";
class LodMaterial extends THREE.ShaderMaterial {
  isLodMaterial = true;
  isLineMaterial = true;
  get lodSize() {
    return this.uniforms.lodSize.value;
  }
  set lodColor(color) {
    this.uniforms.lodColor.value = color;
  }
  set lodSize(value) {
    this.uniforms.lodSize.value.copy(value);
  }
  get lodColor() {
    return this.uniforms.lodColor.value;
  }
  set lodOpacity(value) {
    this.uniforms.lodOpacity.value = value;
  }
  get lodOpacity() {
    return this.uniforms.lodOpacity.value;
  }
  set highlightColor(color) {
    this.uniforms.highlightColor.value = color;
  }
  get highlightColor() {
    return this.uniforms.highlightColor.value;
  }
  set highlightOpacity(value) {
    this.uniforms.highlightOpacity.value = value;
  }
  get highlightOpacity() {
    return this.uniforms.highlightOpacity.value;
  }
  constructor(parameters) {
    super(LodHelper.newLodMaterialParams(parameters));
    this.clipping = true;
    this.lights = false;
    this.needsUpdate = true;
  }
}
export {
  LodMaterial
};
//# sourceMappingURL=lod-material.mjs.map
