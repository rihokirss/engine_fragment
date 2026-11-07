import { Item } from "./item.mjs";
class ItemsManager {
  getItem(model, id) {
    return new Item(model, id);
  }
  async getItemsData(model, ids, config) {
    return model._invoke("getItemsData", [ids, config]);
  }
  async getItemsChildren(model, ids) {
    return model._invoke("getItemsChildren", [ids]);
  }
}
export {
  ItemsManager
};
//# sourceMappingURL=items-manager.mjs.map
