class VisibilityManager {
  async resetVisible(model) {
    await model._invoke("resetVisible");
  }
  async getItemsByVisibility(model, visible) {
    return model._invoke("getItemsByVisibility", [visible]);
  }
  async getVisible(model, localIds) {
    return model._invoke("getVisible", [localIds]);
  }
}
export {
  VisibilityManager
};
//# sourceMappingURL=visibility-manager.mjs.map
