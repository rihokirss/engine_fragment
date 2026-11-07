import * as THREE from "three";
class HighlightHelper {
  _highlightProps = [
    "color",
    "opacity",
    "transparent",
    "renderedFaces",
    "depthTest",
    "depthWrite",
    "polygonOffsetFactor",
    "polygonOffsetUnits"
  ];
  resetHighlight(model, items) {
    let nothingHighlighted = true;
    if (!items) {
      model.itemConfig.clearHighlight();
    } else {
      const itemIds = model.properties.getItemIdsFromLocalIds(items);
      this.resetHighlightForItems(itemIds, model);
      nothingHighlighted = !model.itemConfig.hasAnyHighlight();
    }
    if (nothingHighlighted) {
      model.materials.reclaimHighlights();
    }
    model.tiles.restart();
  }
  getHighlight(model, localIds) {
    const found = [];
    const itemIds = model.properties.getItemIdsFromLocalIds(localIds);
    const fetchEvent = this.getFetchEvent(model, found);
    model.traverse(itemIds, fetchEvent);
    return found;
  }
  getHighlightItems(model) {
    const found = [];
    const count = model.itemConfig.size;
    for (let itemId = 0; itemId < count; itemId++) {
      const hasHighlight = model.itemConfig.getHighlight(itemId);
      if (!hasHighlight) continue;
      const [localId] = model.properties.getLocalIdsFromItemIds([itemId]);
      found.push(localId);
    }
    return found;
  }
  highlight(model, items, material) {
    const itemIds = model.properties.getItemIdsFromLocalIds(items);
    const materials = [];
    const highlightEvent = this.getCheckEvent(model, material, materials);
    model.traverse(itemIds, highlightEvent);
    const ids = model.materials.transfer(materials);
    const createEvent = this.getCreateEvent(model, ids);
    model.traverse(itemIds, createEvent);
    model.tiles.updateVirtualMeshes(itemIds);
  }
  hasEffectiveProperties(material) {
    const { preserveOriginalMaterial, ...rest } = material;
    return Object.keys(rest).length > 0;
  }
  updateHighlightDefinition(model, items, updateFn) {
    const itemIds = model.properties.getItemIdsFromLocalIds(items);
    const itemsToUpdate = [];
    const itemsToClear = [];
    const materials = [];
    for (const itemId of itemIds) {
      const highlightId = model.itemConfig.getHighlight(itemId);
      if (highlightId) {
        const currentHighlight = model.materials.fetch(highlightId);
        const updated = updateFn(currentHighlight);
        if (this.hasEffectiveProperties(updated)) {
          const newMaterial = {
            ...updated,
            preserveOriginalMaterial: true
          };
          materials.push(newMaterial);
          itemsToUpdate.push(itemId);
        } else {
          itemsToClear.push(itemId);
        }
      }
    }
    if (itemsToClear.length > 0) {
      for (const itemId of itemsToClear) {
        model.itemConfig.setHighlight(itemId, 0);
      }
    }
    if (itemsToUpdate.length > 0) {
      const ids = model.materials.transfer(materials);
      const createEvent = this.getCreateEvent(model, ids);
      model.traverse(itemsToUpdate, createEvent);
    }
    model.tiles.updateVirtualMeshes(itemIds);
  }
  setColor(model, items, color) {
    let normalizedColor = color;
    if (color && !color.isColor && typeof color.r === "number") {
      normalizedColor = new THREE.Color().setRGB(
        color.r,
        color.g,
        color.b,
        THREE.SRGBColorSpace
      );
    }
    const material = {
      color: normalizedColor,
      preserveOriginalMaterial: true,
      _explicitProps: ["color"]
    };
    this.highlight(model, items, material);
  }
  resetColor(model, items) {
    this.updateHighlightDefinition(model, items, (current) => {
      const { color: _, ...rest } = current;
      return rest;
    });
  }
  setOpacity(model, items, opacity) {
    const material = {
      opacity,
      transparent: opacity < 1,
      preserveOriginalMaterial: true,
      _explicitProps: ["opacity", "transparent"]
    };
    this.highlight(model, items, material);
  }
  resetOpacity(model, items) {
    this.updateHighlightDefinition(model, items, (current) => {
      const { opacity: _o, transparent: _t, ...rest } = current;
      return rest;
    });
  }
  getFetchEvent(model, found) {
    return (itemId) => {
      const id = model.itemConfig.getHighlight(itemId);
      if (id) {
        const result = model.materials.fetch(id);
        found.push(result);
        return;
      }
      found.push(void 0);
    };
  }
  setHighlightProperty(newHigh, pastHigh, key) {
    if (newHigh[key] === void 0 && pastHigh[key] !== void 0) {
      newHigh[key] = pastHigh[key];
    }
  }
  getNewHighFromPast(model, past, highlightMaterial) {
    const pastHigh = model.materials.fetch(past);
    const newHigh = { ...highlightMaterial };
    const pastExplicit = pastHigh._explicitProps || [];
    const newExplicit = highlightMaterial._explicitProps || [];
    if (pastExplicit.length > 0 || newExplicit.length > 0) {
      for (const prop of pastExplicit) {
        const key = prop;
        if (!newExplicit.includes(prop) && pastHigh[key] !== void 0) {
          newHigh[prop] = pastHigh[key];
        }
      }
      newHigh._explicitProps = [.../* @__PURE__ */ new Set([...pastExplicit, ...newExplicit])];
    } else {
      for (const prop of this._highlightProps) {
        this.setHighlightProperty(newHigh, pastHigh, prop);
      }
    }
    return newHigh;
  }
  getCheckEvent(model, highlightMaterial, materials) {
    return (itemId) => {
      const past = model.itemConfig.getHighlight(itemId);
      if (past !== void 0) {
        const newHigh = this.getNewHighFromPast(model, past, highlightMaterial);
        materials.push(newHigh);
        return;
      }
      materials.push(highlightMaterial);
    };
  }
  getCreateEvent(model, ids) {
    return (itemId, position) => {
      model.itemConfig.setHighlight(itemId, ids[position]);
    };
  }
  resetHighlightForItems(itemIds, model) {
    if (!itemIds) {
      model.itemConfig.clearHighlight();
      return;
    }
    for (const itemId of itemIds) {
      model.itemConfig.setHighlight(itemId, 0);
    }
  }
}
export {
  HighlightHelper
};
//# sourceMappingURL=highlight-helper.mjs.map
