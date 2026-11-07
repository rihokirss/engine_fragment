import { ALIGNMENT_CATEGORY } from "../../model/model-types.mjs";
class AlignmentsController {
  _fragments;
  constructor(virtualFragmentsModel) {
    this._fragments = virtualFragmentsModel;
  }
  getAlignments() {
    const allAlignments = [];
    const alignCat = new RegExp(ALIGNMENT_CATEGORY);
    const allItemsIds = this._fragments.getItemsOfCategories([alignCat]);
    const itemsIds = allItemsIds[ALIGNMENT_CATEGORY];
    if (!itemsIds) {
      return [];
    }
    const alignmentsItems = this._fragments.getItemsData(
      itemsIds,
      {}
    );
    for (const item of alignmentsItems) {
      const data = JSON.parse(item.data.value);
      allAlignments.push(data);
    }
    return allAlignments;
  }
}
export {
  AlignmentsController
};
//# sourceMappingURL=alignments-controller.mjs.map
