class ItemsHelper {
  traverse(model, itemIds, onItem) {
    if (itemIds) {
      this.traverseItems(itemIds, onItem);
      return;
    }
    this.traverseAllItems(model, onItem);
  }
  getItemsByConfig(model, condition) {
    const found = [];
    const count = model.itemConfig.size;
    for (let itemId = 0; itemId < count; itemId++) {
      const conditionPass = condition(itemId);
      if (!conditionPass) continue;
      found.push(itemId);
    }
    return found;
  }
  traverseItems(itemIds, onItem) {
    const itemsCount = itemIds.length;
    for (let id = 0; id < itemsCount; id++) {
      onItem(itemIds[id], id);
    }
  }
  traverseAllItems(model, onItem) {
    const itemsCount = model.itemConfig.size;
    for (let id = 0; id < itemsCount; id++) {
      onItem(id, id);
    }
  }
}
export {
  ItemsHelper
};
//# sourceMappingURL=items-helper.mjs.map
