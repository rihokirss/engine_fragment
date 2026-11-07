import { MultiThreadingRequestClass } from "./model-types.mjs";
class SetupManager {
  async setup(model, bbox, modelData, raw, config) {
    const message = this.getCreateModelMessage(model, modelData, raw, config);
    const data = this.formatModelData(modelData);
    const result = await model.threads.fetch(message, data);
    this.updateBox(bbox, result);
  }
  formatModelData(modelData) {
    if (modelData instanceof ArrayBuffer) {
      return [modelData];
    }
    if (modelData instanceof Uint8Array) {
      return [modelData.buffer];
    }
    return void 0;
  }
  updateBox(bbox, result) {
    bbox.min.copy(result.boundingBox.min);
    bbox.max.copy(result.boundingBox.max);
  }
  getCreateModelMessage(model, modelData, raw, config) {
    return {
      class: MultiThreadingRequestClass.CREATE_MODEL,
      modelId: model.modelId,
      modelData,
      raw,
      config
    };
  }
}
export {
  SetupManager
};
//# sourceMappingURL=setup-manager.mjs.map
