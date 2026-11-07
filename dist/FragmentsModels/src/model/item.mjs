import { ItemAttributes } from "./item-attributes.mjs";
import { ItemRelations } from "./item-relations.mjs";
import { ItemGeometry } from "./item-geometry.mjs";
class Item {
  /**
   * The FragmentsModel instance that this item belongs to.
   */
  model;
  /**
   * Creates a new Item instance.
   * @param model - The FragmentsModel instance that this item belongs to.
   * @param id - The identifier for the item, which can be either a number or a string.
   */
  constructor(model, id) {
    this.model = model;
    if (typeof id === "number") this._localId = id;
    if (typeof id === "string") this._guid = id;
  }
  _localId = null;
  /**
   * Gets the local ID of the item.
   */
  async getLocalId() {
    if (!this._localId) {
      if (this._guid) {
        [this._localId] = await this.model._invoke(
          "getLocalIdsByGuids",
          // @ts-ignore
          [[this._guid]]
        );
      } else {
        throw new Error("Fragments: Item localId couldn't be get.");
      }
    }
    return this._localId;
  }
  _attributes = null;
  /**
   * Gets all the attributes of the item.
   */
  async getAttributes() {
    if (this._attributes) return this._attributes;
    const localId = await this.getLocalId();
    if (localId === null) return null;
    const data = await this.model._invoke(
      "getItemAttributes",
      // @ts-ignore
      [localId]
    );
    this._attributes = new ItemAttributes(localId);
    if (!data) {
      const changes2 = this.model.attrsChanges.get(localId);
      if (!(changes2 && changes2.type === "added")) return null;
      this._attributes.localId = localId;
      for (const [key, value] of Object.entries(changes2.data))
        this._attributes.set(key, value);
      return this._attributes;
    }
    const changes = this.model.attrsChanges.get(localId);
    if (changes && changes.type === "modified") {
      for (const [key, value] of Object.entries(changes.added))
        this._attributes.set(key, value);
    }
    for (const name in data) {
      const { value, type } = data[name];
      if (changes?.type === "modified" && changes.deleted.includes(name))
        continue;
      if (changes?.type === "modified" && name in changes.modified) {
        this._attributes.set(name, changes.modified[name]);
      } else {
        this._attributes.set(name, { value, type });
      }
    }
    this._attributes.tracker = this.model.attrsChanges;
    return this._attributes;
  }
  _relations = null;
  /**
   * Gets all the relations of the item to other items.
   */
  async getRelations() {
    if (this._relations) return this._relations;
    const localId = await this.getLocalId();
    if (localId === null) return null;
    const data = await this.model._invoke(
      "getItemRelations",
      // @ts-ignore
      [localId]
    );
    if (!data) return null;
    this._relations = new ItemRelations(localId);
    this._relations.onItemsRequested = async (ids) => {
      const items = [];
      for (const id of ids) {
        const item = this.model.getItem(id);
        if (!item) continue;
        items.push(item);
      }
      return items;
    };
    const changes = this.model.relsChanges.get(localId);
    if (changes && changes.type === "modified") {
      for (const [key, value] of Object.entries(changes.added))
        this._relations.set(key, value);
    }
    for (const [relation, localIds] of Object.entries(data)) {
      if (changes?.type === "modified" && changes.deleted.has(relation))
        continue;
      if (changes?.type === "modified" && relation in changes.modified) {
        const data2 = /* @__PURE__ */ new Set([...changes.modified[relation], ...localIds]);
        this._relations.set(relation, new Set(data2));
      } else {
        this._relations.set(relation, new Set(localIds));
      }
    }
    this._relations.tracker = this.model.relsChanges;
    return this._relations;
  }
  _guid = null;
  /**
   * Gets the GUID of the item.
   */
  async getGuid() {
    if (!this._guid) {
      const localId = await this.getLocalId();
      if (localId === null) return null;
      [this._guid] = await this.model._invoke(
        "getGuidsByLocalIds",
        // @ts-ignore
        [[localId]]
      );
    }
    return this._guid;
  }
  _category = null;
  /**
   * Gets the category of the item.
   */
  async getCategory() {
    if (!this._category) {
      const localId = await this.getLocalId();
      if (localId === null) return null;
      this._category = await this.model._invoke(
        "getItemCategory",
        // @ts-ignore
        [localId]
      );
    }
    return this._category;
  }
  _geometry = null;
  async getGeometry() {
    if (this._geometry) return this._geometry;
    const localId = await this.getLocalId();
    if (localId === null) return null;
    const geometry = new ItemGeometry(this.model, localId);
    return geometry;
  }
  /**
   * Gets all the data of the item.
   */
  async getData(collector = []) {
    const localId = await this.getLocalId();
    if (localId == null) return {};
    collector.push(localId);
    const attrs = (await this.getAttributes())?.object;
    const rels = await this.getRelations();
    const relAttrs = {};
    if (rels) {
      for (const key of rels.keys()) {
        const keyItems = [];
        relAttrs[key] = keyItems;
        const relItems = await rels.getItems(key);
        if (!relItems) continue;
        for (const item of relItems) {
          const itemId = await item.getLocalId();
          if (!itemId) continue;
          if (collector.find((id) => id === itemId) !== void 0) {
            continue;
          }
          collector.push(itemId);
          const itemAttrs = await item.getData(collector);
          if (!itemAttrs) continue;
          keyItems.push(itemAttrs);
        }
      }
    }
    const data = { ...attrs, ...relAttrs };
    return data;
  }
}
export {
  Item
};
//# sourceMappingURL=item.mjs.map
