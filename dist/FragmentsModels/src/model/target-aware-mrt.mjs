import * as THREE from "three";
let TargetAwareMRTNode = null;
function nodeClass() {
  if (TargetAwareMRTNode) return TargetAwareMRTNode;
  const { MRTNode, OutputStructNode } = THREE;
  TargetAwareMRTNode = class extends MRTNode {
    static warned = false;
    static get type() {
      return "TargetAwareMRTNode";
    }
    setup(builder) {
      const convert = (node, index) => typeof builder.getOutputType === "function" ? node.convert(builder.getOutputType(index)) : THREE.TSL.vec4(node);
      const target = builder.renderer.getRenderTarget();
      const textures = target ? target.textures : [];
      const members = [];
      for (const name in this.outputNodes) {
        const index = textures.findIndex((texture) => texture.name === name);
        if (index < 0) continue;
        members[index] = convert(this.outputNodes[name], index);
      }
      if (members.length === 0 && textures.length > 0 && this.outputNodes.output) {
        members[0] = convert(this.outputNodes.output, 0);
      }
      let gap = -1;
      for (let i = 0; i < members.length; i++) {
        if (members[i] === void 0) {
          gap = i;
          break;
        }
      }
      if (gap >= 0) {
        const lost = members.length - gap;
        members.length = gap;
        if (!TargetAwareMRTNode.warned) {
          TargetAwareMRTNode.warned = true;
          console.warn(
            `[fragments] an MRT skipped channel ${gap} of ${textures.map((t) => t.name).join(", ")} (the material writes ${Object.keys(this.outputNodes).join(", ")}), so ${lost} higher channel(s) were dropped to keep the pipeline valid. Give the material that channel.`
          );
        }
      }
      this.members = members;
      return OutputStructNode.prototype.setup.call(this, builder);
    }
    // The blend modes travel with the outputs. three's own `merge` assigns them to `blendings`, a name
    // nothing reads, so a merged node silently fell back to no blending on every channel but `output`.
    merge(other) {
      const merged = new TargetAwareMRTNode({
        ...this.outputNodes,
        ...other.outputNodes
      });
      merged.blendModes = { ...this.blendModes, ...other.blendModes ?? {} };
      return merged;
    }
  };
  return TargetAwareMRTNode;
}
function targetAwareMRT(outputNodes) {
  const NodeClass = nodeClass();
  return new NodeClass(outputNodes);
}
export {
  targetAwareMRT
};
//# sourceMappingURL=target-aware-mrt.mjs.map
