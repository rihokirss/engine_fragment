import { MaterialManager } from "./material-manager.mjs";
class HighlightManager {
  async getHighlight(model, localIds) {
    const materials = await model._invoke("getHighlight", [
      localIds
    ]);
    MaterialManager.resetColors(materials);
    return materials;
  }
  async highlight(model, localIds, highlightMaterial) {
    await model._invoke("highlight", [localIds, highlightMaterial]);
  }
  async setColor(model, localIds, color) {
    await model._invoke("setColor", [localIds, color]);
  }
  async resetColor(model, localIds) {
    await model._invoke("resetColor", [localIds]);
  }
  async setOpacity(model, localIds, opacity) {
    await model._invoke("setOpacity", [localIds, opacity]);
  }
  async resetOpacity(model, localIds) {
    await model._invoke("resetOpacity", [localIds]);
  }
  async getHighlightItemIds(model) {
    return model._invoke("getHighlightItemIds");
  }
  async resetHighlight(model, localIds) {
    await model._invoke("resetHighlight", [localIds]);
  }
}
export {
  HighlightManager
};
//# sourceMappingURL=highlight-manager.mjs.map
