import * as THREE from "three";
import { MultiThreadingRequestClass } from "./model-types.mjs";
class BoxManager {
  async getBoxes(model, localIds) {
    const ids = this.getIndividualBoxesIds(localIds);
    const request = this.getBoxRequest(model, ids);
    const response = await model.threads.fetch(request);
    return this.getAllBoxes(response, model);
  }
  async getMergedBox(model, localIds) {
    const request = this.getBoxRequest(model, [localIds]);
    const { boxes } = await model.threads.fetch(request);
    const [box] = boxes;
    return this.getAbsoluteBox(box, model);
  }
  getAbsoluteBox(box, model) {
    const merged = new THREE.Box3();
    merged.copy(box);
    merged.applyMatrix4(model.object.matrixWorld);
    return merged;
  }
  getIndividualBoxesIds(localIds) {
    if (!localIds) return void 0;
    const ids = [];
    for (const id of localIds) {
      ids.push([id]);
    }
    return ids;
  }
  getAllBoxes(response, model) {
    const rawBoxes = response.boxes;
    const result = [];
    for (const box of rawBoxes) {
      const newBox = new THREE.Box3();
      newBox.copy(box);
      newBox.applyMatrix4(model.object.matrixWorld);
      result.push(newBox);
    }
    return result;
  }
  getBoxRequest(model, localIds) {
    return {
      class: MultiThreadingRequestClass.FETCH_BOXES,
      modelId: model.modelId,
      localIds
    };
  }
}
export {
  BoxManager
};
//# sourceMappingURL=box-manager.mjs.map
