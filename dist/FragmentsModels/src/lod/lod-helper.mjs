import * as THREE from "three";
import { LodShaders } from "./lod-shaders.mjs";
import { trackGhostOpacity, classicGhostOpacity } from "../model/ghost-opacity.mjs";
class LodHelper {
  static tempVec = new THREE.Vector3();
  static tempBox = new THREE.Box3();
  static setupLodMeshResize(mesh) {
    mesh.onBeforeRender = (renderer) => {
      renderer.getSize(mesh.material[0].lodSize);
    };
  }
  static setupLodAttributes(geometry) {
    geometry.setIndex(LodHelper.indices);
    geometry.setAttribute("position", LodHelper.vertices);
  }
  static setLodBuffer(lodGeometry, data, onFinish) {
    let itemFirst = lodGeometry.getItemFirst();
    let itemLast = lodGeometry.getItemLast();
    let dataBuffer = this.setItemFirst(lodGeometry, itemFirst, data, itemLast);
    const result = this.resetAttributes(itemFirst, dataBuffer, data, itemLast);
    ({ itemFirst, dataBuffer, itemLast } = result);
    this.setupFinish(onFinish, dataBuffer);
    lodGeometry.setAttribute("itemFirst", itemFirst);
    lodGeometry.setAttribute("itemLast", itemLast);
  }
  static setLodVisibility(lodGeometry, visible) {
    const itemFilter = this.setupItemFilter(lodGeometry);
    this.applyVisibilityState(lodGeometry, visible, itemFilter);
    itemFilter.needsUpdate = true;
  }
  static getInterAttribute(geometry, name) {
    return geometry.getAttribute(name);
  }
  static computeLodSphere(geometry) {
    if (!geometry.boundingSphere) {
      return;
    }
    const itemFirst = geometry.getItemFirst();
    if (itemFirst) {
      const midPoint = LodHelper.getLodMidPoint(geometry, itemFirst);
      const radius = LodHelper.getLodRadius(midPoint, itemFirst);
      geometry.boundingSphere.radius = radius;
    }
  }
  static newLodMaterialParams(parameters) {
    const customUniforms = {
      lodColor: { value: new THREE.Color(parameters.color) },
      lodSize: { value: new THREE.Vector2(1, 1) },
      lodOpacity: { value: parameters.opacity ?? 1 },
      highlightColor: { value: new THREE.Color(1, 1, 1) },
      highlightOpacity: { value: 1 },
      // Ghost (x-ray) screen-door keep-fraction for LOD lines; only read when
      // the GHOST_LOD define is set (see lod-shaders / material-manager).
      uLodGhostOpacity: { value: classicGhostOpacity() }
    };
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      customUniforms
    ]);
    trackGhostOpacity(uniforms.uLodGhostOpacity);
    const transparent = parameters.transparent ?? false;
    return {
      uniforms,
      transparent,
      vertexShader: LodShaders.vertex,
      fragmentShader: LodShaders.fragment
    };
  }
  static setLodFilter(geometry, data) {
    const itemFilter = geometry.getItemFilter();
    const bufferData = itemFilter.array;
    for (let i = 0; i < data.position.length; ++i) {
      const first = data.position[i] / 2;
      const size = data.size[i] / 2;
      if (size === 4294967295) {
        bufferData.fill(1, first);
      } else {
        bufferData.fill(1, first, first + size);
      }
    }
    itemFilter.needsUpdate = true;
  }
  static setLodHighlight(geometry, data) {
    const itemFilter = geometry.getItemFilter();
    const bufferData = itemFilter.array;
    for (let i = 0; i < data.position.length; ++i) {
      const first = data.position[i] / 2;
      const size = data.size[i] / 2;
      if (size === 4294967295) {
        bufferData.fill(2, first);
      } else {
        bufferData.fill(2, first, first + size);
      }
    }
    itemFilter.needsUpdate = true;
  }
  // Writes a per-instance highlight color over the same chunk ranges that
  // setLodHighlight flags as highlighted, so each item keeps its own color at
  // LOD/WIRES distance instead of all collapsing to a single uniform (#230).
  // `colors[i]` is parallel to `data`'s chunks; undefined entries are skipped.
  static setLodHighlightColors(geometry, data, colors) {
    const itemFilter = geometry.getItemFilter();
    if (!itemFilter) return;
    const count = itemFilter.count;
    let colorAttr = this.getInstancedAttribute(geometry, "itemHighlightColor");
    if (!colorAttr || colorAttr.count !== count) {
      colorAttr = new THREE.InstancedBufferAttribute(
        new Float32Array(count * 3).fill(1),
        3
      );
      geometry.setAttribute("itemHighlightColor", colorAttr);
    }
    const bufferData = colorAttr.array;
    for (let i = 0; i < data.position.length; ++i) {
      const color = colors[i];
      if (!color) continue;
      const first = Math.floor(data.position[i] / 2);
      const size = data.size[i] / 2;
      const end = size === 4294967295 ? count : Math.min(first + size, count);
      for (let inst = first; inst < end; ++inst) {
        bufferData[inst * 3] = color.r;
        bufferData[inst * 3 + 1] = color.g;
        bufferData[inst * 3 + 2] = color.b;
      }
    }
    colorAttr.needsUpdate = true;
  }
  static getInstancedAttribute(geometry, name) {
    return geometry.getAttribute(name);
  }
  static computeLodBox(geometry) {
    if (!geometry.boundingBox) {
      return;
    }
    const position = geometry.getItemFirst();
    if (position) {
      const buffer = position.data.array;
      geometry.boundingBox.setFromArray(buffer);
      return;
    }
    geometry.boundingBox.makeEmpty();
  }
  static setDataBuffer(dataBuffer, itemFirst, data) {
    dataBuffer = itemFirst.data;
    dataBuffer.array = data;
    dataBuffer.needsUpdate = true;
    return dataBuffer;
  }
  static disposeAllData(geometry) {
    delete geometry.attributes.itemFilter;
    delete geometry.attributes.itemHighlightColor;
    delete geometry.attributes.position;
    geometry.index = null;
    geometry.dispose();
    LodHelper.setupLodAttributes(geometry);
  }
  static setItemFirst(lodGeometry, itemFirst, data, itemLast) {
    let dataBuffer = null;
    if (itemFirst) {
      const sizeMatch = data.length === itemFirst.data.array.length;
      if (sizeMatch) {
        dataBuffer = this.setDataBuffer(dataBuffer, itemFirst, data);
      } else {
        itemFirst = void 0;
        this.disposeAllData(lodGeometry);
      }
    }
    return dataBuffer;
  }
  static setupFinish(onFinish, dataBuffer) {
    if (onFinish) {
      dataBuffer.onUploadCallback = onFinish;
    }
  }
  static resetAttributes(itemFirst, dataBuffer, data, itemLast) {
    if (!itemFirst) {
      dataBuffer = new THREE.InstancedInterleavedBuffer(data, 6, 1);
      itemFirst = new THREE.InterleavedBufferAttribute(dataBuffer, 3, 0);
      itemLast = new THREE.InterleavedBufferAttribute(dataBuffer, 3, 3);
    }
    return { itemFirst, dataBuffer, itemLast };
  }
  static setupItemFilter(lodGeometry) {
    const itemFirst = lodGeometry.getItemFirst();
    const size = itemFirst.count;
    let itemFilter = lodGeometry.getItemFilter();
    if (itemFilter) {
      itemFilter.array.fill(0);
    } else {
      itemFilter = new THREE.InstancedBufferAttribute(new Uint8Array(size), 1);
      lodGeometry.setAttribute("itemFilter", itemFilter);
    }
    return itemFilter;
  }
  static applyVisibilityState(lodGeometry, visible, itemFilter) {
    if (visible === true) {
      itemFilter.array.fill(1);
      return;
    }
    if (visible) {
      this.setLodFilter(lodGeometry, visible);
    }
  }
  static getLodMidPoint(geometry, itemFirst) {
    const midpoint = geometry.boundingSphere.center;
    this.tempBox.setFromArray(itemFirst.data.array);
    this.tempBox.getCenter(midpoint);
    return midpoint;
  }
  static getLodRadius(midPoint, itemFirst) {
    let threshold = 0;
    const size = itemFirst.data.array.length;
    for (let i = 0; i < size; i += 3) {
      const dataBuffer = itemFirst.data.array;
      LodHelper.tempVec.fromArray(dataBuffer, i);
      const distance = midPoint.distanceToSquared(LodHelper.tempVec);
      threshold = Math.max(threshold, distance);
    }
    return Math.sqrt(threshold);
  }
  // prettier-ignore
  static vertices = new THREE.Float32BufferAttribute(
    [
      -1,
      2,
      0,
      1,
      2,
      0,
      -1,
      1,
      0,
      1,
      1,
      0,
      -1,
      0,
      0,
      1,
      0,
      0,
      -1,
      -1,
      0,
      1,
      -1,
      0
    ],
    3
  );
  // prettier-ignore
  static indices = new THREE.Uint8BufferAttribute(
    [
      0,
      2,
      1,
      2,
      3,
      1,
      2,
      4,
      3,
      4,
      5,
      3,
      4,
      6,
      5,
      6,
      7,
      5
    ],
    1
  );
}
export {
  LodHelper
};
//# sourceMappingURL=lod-helper.mjs.map
