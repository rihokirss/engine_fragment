class VisibilityHelper {
  _hiddenForEdit = /* @__PURE__ */ new Set();
  resetVisible(model) {
    model.itemConfig.clearVisible();
    model.tiles.restart();
  }
  getVisible(model, items) {
    const itemIds = model.properties.getItemIdsFromLocalIds(items);
    const result = [];
    for (const id of itemIds) {
      if (this._hiddenForEdit.has(id)) {
        continue;
      }
      const isVisible = model.itemConfig.visible(id);
      result.push(isVisible);
    }
    return result;
  }
  getItemsByVisibility(model, visible) {
    const visibleCondition = this.getVisibleCondition(model, visible);
    const result = model.getItemsByConfig(visibleCondition);
    const localIds = model.properties.getLocalIdsFromItemIds(result);
    const filtered = this.filterHiddenForEdit(localIds);
    return filtered;
  }
  toggleVisible(model, localIds) {
    const itemIds = model.properties.getItemIdsFromLocalIds(localIds);
    const filtered = this.filterHiddenForEdit(itemIds);
    const toggleEvent = this.getToggleEvent(model);
    model.traverse(filtered, toggleEvent);
    model.tiles.updateVirtualMeshes(filtered);
  }
  setVisible(model, localIds, visible) {
    const itemIds = model.properties.getItemIdsFromLocalIds(localIds);
    const filtered = this.filterHiddenForEdit(itemIds);
    const setEvent = this.getSetEvent(model, visible);
    model.traverse(filtered, setEvent);
    model.tiles.updateVirtualMeshes(filtered);
  }
  // Edited items are hidden and ignore all future visibility requests
  // Because their visibility is handled from the delta model
  hideForEdit(model, localIds) {
    this.setVisible(model, localIds, false);
    for (const id of localIds) {
      this._hiddenForEdit.add(id);
    }
  }
  // Remove items from the hidden-for-edit set so future setVisible calls
  // can control them again. Used when navigating history back to a state
  // where those items are no longer in the delta.
  unhideForEdit(localIds) {
    for (const id of localIds) {
      this._hiddenForEdit.delete(id);
    }
  }
  // Clear the entire hidden-for-edit set. Used when undoing all edits
  // so every item can be made visible on the base model again.
  clearHiddenForEdit() {
    this._hiddenForEdit.clear();
  }
  filterHiddenForEdit(localIds) {
    if (!this._hiddenForEdit.size) {
      return localIds;
    }
    const result = [];
    for (const id of localIds) {
      if (this._hiddenForEdit.has(id)) {
        continue;
      }
      result.push(id);
    }
    return result;
  }
  getSetEvent(model, visible) {
    return (itemId) => {
      model.itemConfig.setVisible(itemId, visible);
    };
  }
  getVisibleCondition(model, visible) {
    return (itemId) => {
      const currentVisible = model.itemConfig.visible(itemId);
      return currentVisible === visible;
    };
  }
  getToggleEvent(model) {
    return (itemId) => {
      const isVisible = model.itemConfig.visible(itemId);
      model.itemConfig.setVisible(itemId, !isVisible);
    };
  }
}
export {
  VisibilityHelper
};
//# sourceMappingURL=visibility-helper.mjs.map
