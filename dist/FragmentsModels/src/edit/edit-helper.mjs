import { isIndexRequest, EditRequestType } from "../../../Utils/edit/edit-types.mjs";
import { EditUtils } from "../../../Utils/edit/edit-utils.mjs";
import { FragmentsModel } from "../model/fragments-model.mjs";
const RENDER_AFFECTING_REQUESTS = /* @__PURE__ */ new Set([
  EditRequestType.CREATE_MATERIAL,
  EditRequestType.CREATE_REPRESENTATION,
  EditRequestType.CREATE_SAMPLE,
  EditRequestType.CREATE_GLOBAL_TRANSFORM,
  EditRequestType.CREATE_LOCAL_TRANSFORM,
  EditRequestType.UPDATE_MATERIAL,
  EditRequestType.UPDATE_REPRESENTATION,
  EditRequestType.UPDATE_SAMPLE,
  EditRequestType.UPDATE_GLOBAL_TRANSFORM,
  EditRequestType.UPDATE_LOCAL_TRANSFORM,
  EditRequestType.DELETE_MATERIAL,
  EditRequestType.DELETE_REPRESENTATION,
  EditRequestType.DELETE_SAMPLE,
  EditRequestType.DELETE_GLOBAL_TRANSFORM,
  EditRequestType.DELETE_LOCAL_TRANSFORM,
  EditRequestType.DELETE_ITEM
]);
class EditHelper {
  _deltaModels = {};
  _fragments;
  _connection;
  constructor(core, connection) {
    this._fragments = core;
    this._connection = connection;
  }
  async edit(modelId, actions, config = {
    removeRedo: true
  }) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    const onlyDataEdits = actions.length > 0 && actions.every((action) => !RENDER_AFFECTING_REQUESTS.has(action.type));
    const oldDeltaModels = this._deltaModels[modelId] || [];
    this._deltaModels[modelId] = null;
    if (config.removeRedo) {
      model._setRequests({ undoneRequests: [] });
    }
    const { deltaModelBuffer, ids } = await model._edit(actions);
    let idsIdx = 0;
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (isIndexRequest(action)) continue;
      if (action.localId !== void 0) {
        continue;
      }
      action.localId = ids[idsIdx++];
    }
    if (onlyDataEdits) {
      this._deltaModels[modelId] = oldDeltaModels.length ? oldDeltaModels : null;
      return ids;
    }
    const deltaModel = await this.load(deltaModelBuffer, model);
    this._deltaModels[modelId] = [deltaModel];
    model.deltaModelId = deltaModel.modelId;
    for (const oldDeltaModel of oldDeltaModels) {
      oldDeltaModel.object.visible = false;
    }
    const deletePromises = [];
    for (const oldDeltaModel of oldDeltaModels) {
      deletePromises.push(oldDeltaModel.dispose());
      this._fragments.models.list.delete(oldDeltaModel.modelId);
    }
    await Promise.all(deletePromises);
    return ids;
  }
  async save(modelId) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      console.log(`Model ${modelId} not found`);
      return null;
    }
    const parent = model.object.parent;
    const requests = await model._getRequests();
    const camera = model.camera || void 0;
    const newModelBuffer = await model._save();
    await model.dispose({ keepInScene: true });
    const newModel = await this._fragments.load(newModelBuffer, {
      modelId,
      raw: true,
      camera
    });
    await newModel._setRequests({ undoneRequests: requests.undoneRequests });
    if (parent) {
      parent.add(newModel.object);
    }
    model.finalizeDispose();
    return requests;
  }
  async reset(modelId) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      console.log(`Model ${modelId} not found`);
      return;
    }
    await model._reset();
    await this.disposeDeltaModels(modelId);
  }
  async getRequests(modelId) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    return model._getRequests();
  }
  async getRequestsSince(modelId, from, generation) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    return model._getRequestsSince(from, generation);
  }
  async selectRequest(modelId, index) {
    const model = this._fragments.models.list.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    return model._selectRequest(index);
  }
  async _update(modelId) {
    const models = this._deltaModels[modelId];
    if (models) {
      const promises = [];
      for (const deltaModel of models) {
        promises.push(deltaModel._refreshView());
      }
      await Promise.all(promises);
    }
  }
  async disposeDeltaModels(modelId) {
    const models = this._deltaModels[modelId];
    if (models) {
      for (const deltaModel of models) {
        await deltaModel.dispose();
      }
      this._deltaModels[modelId] = [];
    }
  }
  async load(buffer, parentModel) {
    const deltaId = EditUtils.DELTA_MODEL_ID;
    const modelId = `${parentModel.modelId}${deltaId}${performance.now()}`;
    const deltaModel = new FragmentsModel(
      modelId,
      this._fragments.models,
      this._connection,
      this._fragments.editor
    );
    deltaModel._setDeltaModel(parentModel.modelId);
    deltaModel.frozen = true;
    deltaModel.graphicsQuality = this._fragments.settings.graphicsQuality;
    const virtualModelConfig = {
      multithreading: {
        meshConnectionRate: this._fragments.settings.meshConnectionRate,
        meshConnectionThreshold: this._fragments.settings.meshConnectionThreshold,
        threadUpdaterDelay: this._fragments.settings.threadUpdaterDelay
      }
    };
    try {
      this._fragments.models.list.set(deltaModel.modelId, deltaModel);
      await deltaModel._setup(buffer, true, virtualModelConfig);
      parentModel.object.add(deltaModel.object);
    } catch (e) {
      this._fragments.models.list.delete(deltaModel.modelId);
      throw e;
    }
    const camera = parentModel.camera;
    if (camera) {
      deltaModel.useCamera(camera);
    }
    deltaModel._frozen = false;
    await deltaModel._refreshView();
    await this._fragments.models.forceUpdateFinish();
    return deltaModel;
  }
}
export {
  EditHelper
};
//# sourceMappingURL=edit-helper.mjs.map
