import { GRID_CATEGORY } from "../../model/model-types.mjs";
class GridsController {
  _fragments;
  constructor(virtualFragmentsModel) {
    this._fragments = virtualFragmentsModel;
  }
  async getGrids() {
    const allGrids = [];
    const gridCat = new RegExp(GRID_CATEGORY);
    const allItemsIds = this._fragments.getItemsOfCategories([gridCat]);
    const itemsIds = allItemsIds[GRID_CATEGORY];
    if (!itemsIds) {
      return [];
    }
    const gridsItems = this._fragments.getItemsData(
      itemsIds,
      {}
    );
    for (const item of gridsItems) {
      const data = JSON.parse(item.data.value);
      allGrids.push(data);
    }
    return allGrids;
  }
}
export {
  GridsController
};
//# sourceMappingURL=grids-controller.mjs.map
