import { Meshes } from "../../../../Schema/meshes.mjs";
import { EditRequestType } from "../../../../Utils/edit/edit-types.mjs";
const legacyRelationNames = {
  DefinesOcurrence: "DefinesOccurrence",
  DefinesOccurrence: "DefinesOcurrence"
};
class VirtualPropertiesController {
  _model;
  _boxes;
  _localIdsToGeometryIds = /* @__PURE__ */ new Map();
  _guidToLocalIdMap = /* @__PURE__ */ new Map();
  _items = /* @__PURE__ */ new Map();
  _itemDataCache = /* @__PURE__ */ new Map();
  _itemDataConfig = {
    attributesDefault: true,
    relationsDefault: { attributes: false, relations: false }
  };
  _spatialStructure = null;
  _virtualModel;
  constructor(virtualModel, boxes, config) {
    this._virtualModel = virtualModel;
    this._model = virtualModel.data;
    this._boxes = boxes;
    this.preindexGeometryIds();
    if (config && config.extraRelations) {
      for (const extra of config.extraRelations) {
        const { category, relation, inverseName } = extra;
        this.addInverseRelation(category, relation, inverseName);
      }
    }
    const localIds = this._model.localIdsArray();
    if (localIds) {
      for (let i = 0; i < this._model.localIdsLength(); i++) {
        const category = this._model.categories(i);
        const localId = localIds[i];
        let itemInfo = this._items.get(localId);
        if (!itemInfo) {
          itemInfo = {
            category: null,
            guid: null,
            geometryIds: null,
            attrs: null
          };
          this._items.set(localId, itemInfo);
        }
        itemInfo.category = category;
      }
      for (let i = 0; i < this._model.guidsItemsLength(); i++) {
        const localId = this._model.guidsItems(i);
        if (localId === null) continue;
        const guid = this._model.guids(i);
        this._guidToLocalIdMap.set(guid, localId);
        let itemInfo = this._items.get(localId);
        if (!itemInfo) {
          itemInfo = {
            category: null,
            guid: null,
            geometryIds: null,
            attrs: null
          };
          this._items.set(localId, itemInfo);
        }
        itemInfo.guid = guid;
      }
    }
  }
  _relations = /* @__PURE__ */ new Map();
  // Memoized localId → array index lookups. The flatbuffer accessors return
  // a fresh TypedArray view on every call, so the caches are keyed by the
  // underlying buffer and length instead of array identity. Without these,
  // every getItemAttributes/getItemRelations call does a linear indexOf scan,
  // which makes bulk reads (e.g. getItemsData over all psets) O(n²).
  _localIdIndexCache = null;
  _relationsItemIndexCache = null;
  indexOfLocalId(localId) {
    const arr = this._model.localIdsArray();
    if (!arr) return void 0;
    let cache = this._localIdIndexCache;
    if (!cache || cache.length !== arr.length || cache.buffer !== arr.buffer) {
      const map = /* @__PURE__ */ new Map();
      for (let i = 0; i < arr.length; i++) map.set(arr[i], i);
      cache = { buffer: arr.buffer, length: arr.length, map };
      this._localIdIndexCache = cache;
    }
    return cache.map.get(localId) ?? -1;
  }
  indexOfRelationsItem(localId) {
    const arr = this._model.relationsItemsArray();
    if (!arr) return void 0;
    let cache = this._relationsItemIndexCache;
    if (!cache || cache.length !== arr.length || cache.buffer !== arr.buffer) {
      const map = /* @__PURE__ */ new Map();
      for (let i = 0; i < arr.length; i++) map.set(arr[i], i);
      cache = { buffer: arr.buffer, length: arr.length, map };
      this._relationsItemIndexCache = cache;
    }
    return cache.map.get(localId) ?? -1;
  }
  getAllLocalIds() {
    return this._model.localIdsArray() ?? [];
  }
  addInverseRelation(category, relation, inverseName) {
    const categoriesIds = this.getItemsOfCategories([
      new RegExp(`^${category}$`)
    ]);
    const psetLocalIds = categoriesIds[category];
    for (const psetId of psetLocalIds) {
      const relations = this.getItemRelations(psetId);
      if (!(relations && relations[relation])) continue;
      const localIds = relations[relation];
      for (const itemId of localIds) {
        let relationsObject = this._relations.get(itemId);
        if (!relationsObject) {
          relationsObject = {};
          this._relations.set(itemId, relationsObject);
        }
        let inverse = relationsObject[inverseName];
        if (!inverse) {
          inverse = [];
          relationsObject[inverseName] = inverse;
        }
        inverse.push(psetId);
      }
    }
  }
  getItemsCount() {
    return this._model.localIdsLength();
  }
  getMaxLocalId() {
    return this._model.maxLocalId();
  }
  getMetadata() {
    const metadata = this._model.metadata();
    if (!metadata) {
      return null;
    }
    return JSON.parse(metadata);
  }
  getCRS() {
    const metadata = this.getMetadata();
    if (!metadata || !metadata.crs) {
      return null;
    }
    return metadata.crs;
  }
  getItemIdsFromLocalIds(localIds) {
    if (!localIds) {
      const meshes = this._model.meshes();
      if (!meshes) return [];
      const count = meshes.meshesItemsLength();
      const all = new Array(count);
      for (let itemId = 0; itemId < count; itemId++) all[itemId] = itemId;
      return all;
    }
    const itemIds = [];
    for (const localId of localIds) {
      const found = this._localIdsToGeometryIds.get(localId);
      if (!found) continue;
      for (const itemId of found) {
        itemIds.push(itemId);
      }
    }
    return itemIds;
  }
  getLocalIdsFromItemIds(itemIds) {
    const meshes = this._model.meshes();
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const itemId of itemIds) {
      const localIdIndex = meshes.meshesItems(itemId);
      if (localIdIndex === null) continue;
      const localId = this._model.localIds(localIdIndex);
      if (localId === null) continue;
      if (seen.has(localId)) continue;
      seen.add(localId);
      result.push(localId);
    }
    return result;
  }
  getBox(items, result) {
    for (const itemId of items) {
      const currentBoxesIds = this._boxes.sampleOf(itemId);
      if (currentBoxesIds) {
        for (const currentBoxId of currentBoxesIds) {
          const currentBox = this._boxes.get(currentBoxId);
          result.union(currentBox);
        }
      }
    }
  }
  getSpatialStructure() {
    if (this._spatialStructure) {
      return this._spatialStructure;
    }
    const structure = this._model.spatialStructure();
    if (!structure) {
      return {};
    }
    this._spatialStructure = this.getTreeItem(structure);
    return this._spatialStructure;
  }
  getItemsChildren(ids) {
    const result = /* @__PURE__ */ new Set();
    for (const id of ids) {
      const localId = this.convertToLocalId(id);
      if (localId === null) continue;
      this.traverseSpatialStructure(localId, result);
    }
    return [...result];
  }
  getGuids() {
    const guids = [];
    for (let i = 0; i < this._model.guidsLength(); i++) {
      const guid = this._model.guids(i);
      guids.push(guid);
    }
    return guids;
  }
  getLocalIds() {
    const array = this._model.localIdsArray();
    if (!array) return [];
    return Array.from(array);
  }
  getItemsCategories(ids) {
    const result = [];
    for (const id of ids) {
      const localId = this.convertToLocalId(id);
      if (localId === null) continue;
      let category = this._items.get(localId)?.category ?? null;
      if (category === null) {
        const created = this._virtualModel.requestIndex.first(
          localId,
          EditRequestType.CREATE_ITEM
        );
        if (created) {
          category = created.data.category;
        }
      }
      result.push(category);
    }
    return result;
  }
  getLocalIdsByGuids(guids) {
    const result = [];
    for (const guid of guids) {
      const localId = this._guidToLocalIdMap.get(guid);
      result.push(localId !== void 0 ? localId : null);
    }
    return result;
  }
  getGuidsByLocalIds(localIds) {
    const result = [];
    for (const id of localIds) {
      const guid = this._items.get(id)?.guid;
      result.push(guid !== void 0 ? guid : null);
    }
    return result;
  }
  getAttributeNames() {
    const names = /* @__PURE__ */ new Set();
    for (let i = 0; i < this._model.uniqueAttributesLength(); i++) {
      const attribute = this._model.uniqueAttributes(i);
      if (!attribute) continue;
      const [name] = JSON.parse(attribute);
      names.add(name);
    }
    return [...names];
  }
  getAttributeValues() {
    const values = /* @__PURE__ */ new Set();
    for (let i = 0; i < this._model.uniqueAttributesLength(); i++) {
      const attribute = this._model.uniqueAttributes(i);
      if (!attribute) continue;
      const [, value] = JSON.parse(attribute);
      values.add(value);
    }
    return [...values];
  }
  getAttributesUniqueValues(params) {
    const map = /* @__PURE__ */ new Map();
    const areCategoriesDefined = params.every(
      (value) => value.categories !== void 0
    );
    const categoriesRegex = params.map((value) => value.categories).filter((value) => value !== void 0).flat();
    for (let i = 0; i < this._model.categoriesLength(); i++) {
      const localId = this._model.localIds(i);
      if (localId === null) continue;
      let valid = true;
      if (areCategoriesDefined) {
        const category2 = this._model.categories(i);
        valid = categoriesRegex.some((regex) => regex?.test(category2));
      }
      if (!valid) continue;
      const buffer = this._model.attributes(i);
      if (!buffer) continue;
      const attributeSet = {};
      for (let j = 0; j < buffer.dataLength(); j++) {
        const attr = buffer.data(j);
        if (!attr) continue;
        const [name, value, type] = JSON.parse(attr);
        attributeSet[name] = { value, type };
      }
      const keys = Object.keys(attributeSet);
      const category = this._model.categories(i);
      for (const { key: resultKey, attributes, get, categories } of params) {
        let categoryMatch = true;
        if (categories) {
          categoryMatch = categories.some((value) => value.test(category));
        }
        if (!categoryMatch) continue;
        let setPasses = true;
        if (attributes) {
          const { aggregation, queries } = attributes;
          const queryResults = [];
          for (const { name, value, type, negate } of queries) {
            const key = keys.find((key2) => name.test(key2));
            if (!(key && attributeSet[key]?.value !== void 0)) break;
            let pass = false;
            const { value: keyValue, type: keyType } = attributeSet[key];
            if (value instanceof RegExp) {
              pass = typeof keyValue === "string" && value.test(keyValue);
            } else {
              pass = keyValue === value;
            }
            if (type !== void 0) {
              pass = pass && typeof keyType === "string" && type.test(keyType);
            }
            if (negate) pass = !pass;
            queryResults.push(pass);
          }
          setPasses = aggregation === "exclusive" ? queryResults.every((result2) => result2) : queryResults.some((result2) => result2);
        }
        if (setPasses) {
          const key = keys.find((key2) => get.test(key2));
          if (!(key && attributeSet[key]?.value !== void 0)) continue;
          const mapKey = resultKey ?? key;
          const value = attributeSet[key]?.value;
          if (!map.has(mapKey)) {
            map.set(mapKey, /* @__PURE__ */ new Map());
          }
          const valueMap = map.get(mapKey);
          if (!valueMap.has(value)) {
            valueMap.set(value, /* @__PURE__ */ new Set());
          }
          valueMap.get(value).add(localId);
        }
      }
    }
    const result = {};
    for (const [name, valueMap] of map) {
      result[name] = [];
      for (const [value, itemsSet] of valueMap) {
        result[name].push({
          value,
          localIds: Array.from(itemsSet)
        });
      }
    }
    return result;
  }
  getAttributeTypes() {
    const types = /* @__PURE__ */ new Set();
    for (let i = 0; i < this._model.uniqueAttributesLength(); i++) {
      const attribute = this._model.uniqueAttributes(i);
      if (!attribute) continue;
      const [, , type] = JSON.parse(attribute);
      types.add(type);
    }
    return [...types];
  }
  getRelationNames() {
    const names = /* @__PURE__ */ new Set();
    for (let i = 0; i < this._model.relationNamesLength(); i++) {
      const name = this._model.relationNames(i);
      if (!name) continue;
      names.add(name);
    }
    return [...names];
  }
  // getItemsAttributes(ids: Identifier[]) {
  //   const result: (Record<string, { value: any; type?: string }> | null)[] =
  //     new Array(ids.length).fill(null);
  //   const localIdToIndexMap = new Map<number | string, number>();
  //   ids.forEach((id, index) => {
  //     localIdToIndexMap.set(id, index);
  //   });
  //   let found = 0;
  //   const count = this._model.localIdsLength();
  //   for (let i = 0; i < count; i++) {
  //     const localId = this._model.localIds(i);
  //     if (localId === null) continue;
  //     const index = localIdToIndexMap.get(localId);
  //     if (index === undefined) continue;
  //     const attributesBuffer = this._model.attributes(i);
  //     if (!attributesBuffer) {
  //       result[index] = null;
  //       continue;
  //     }
  //     const attributes: Record<string, { value: any; type?: string }> = {};
  //     for (let j = 0; j < attributesBuffer.dataLength(); j++) {
  //       const data = attributesBuffer.data(j);
  //       const [name, value, type] = data;
  //       attributes[name] = { value, type };
  //     }
  //     result[index] = attributes;
  //     found++;
  //     if (ids.length === found) {
  //       break;
  //     }
  //   }
  //   return result;
  // }
  getItemAttributes(id) {
    const isLocalId = typeof id === "number";
    const localId = isLocalId ? id : this.getLocalIdsByGuids([id])[0];
    if (localId === null) {
      return null;
    }
    const edited = this._virtualModel.requestIndex.latest(
      localId,
      EditRequestType.CREATE_ITEM,
      // DO NOT remove this or editing created items break
      // if you have problems with this, contact Antonio
      EditRequestType.UPDATE_ITEM
    );
    const index = this.indexOfLocalId(localId);
    if (index === void 0 || index === -1) {
      if (edited) {
        const data2 = {};
        for (const name in edited.data.data) {
          const found = edited.data.data[name];
          data2[name] = { value: found.value, type: found.type };
        }
        return data2;
      }
      return null;
    }
    const buffer = this._model.attributes(index);
    if (!buffer) {
      return null;
    }
    const data = {};
    if (edited) {
      for (const name in edited.data.data) {
        const found = edited.data.data[name];
        data[name] = { value: found.value, type: found.type };
      }
      return data;
    }
    for (let j = 0; j < buffer.dataLength(); j++) {
      const attr = buffer.data(j);
      if (!attr) {
        continue;
      }
      this.parseAttribute(attr, data);
    }
    return data;
  }
  parseAttribute(attr, data) {
    const [name, value, type] = JSON.parse(attr);
    data[name] = { value, type };
  }
  getItemData(id, config = {}) {
    const allAttributes = this._itemDataConfig.attributesDefault;
    const attributesConfig = this._itemDataConfig.attributes;
    const relationsConfig = this._itemDataConfig.relations ?? {};
    let { attributes, relations } = this._itemDataConfig.relationsDefault;
    const { parentName, rel } = config;
    const configKey = (name) => {
      if (!name) return void 0;
      if (name in relationsConfig) return name;
      const alias = legacyRelationNames[name];
      return alias && alias in relationsConfig ? alias : void 0;
    };
    const relKey = configKey(rel);
    const parentKey = configKey(parentName);
    if (!parentName && !rel) {
      attributes = true;
      relations = true;
    } else {
      if (relKey) {
        const toProcess = relationsConfig[relKey];
        if (toProcess) {
          attributes = toProcess.attributes;
          relations = toProcess.relations;
        }
      } else if (parentKey) {
        const toProcess = relationsConfig[parentKey];
        if (toProcess) {
          attributes = toProcess.attributes;
          relations = toProcess.relations;
        }
      }
    }
    if (!attributes && !relations) {
      return {};
    }
    if (this._itemDataCache.has(id)) {
      return this._itemDataCache.get(id);
    }
    const localId = typeof id === "number" ? id : this._guidToLocalIdMap.get(id) ?? null;
    if (localId === null || this._virtualModel.requestIndex.deletedItems.has(localId)) {
      return {};
    }
    const [category] = this.getItemsCategories([localId]);
    const guid = typeof id === "string" ? id : this._items.get(id)?.guid ?? null;
    const data = {
      _category: { value: category },
      _localId: { value: localId },
      _guid: { value: guid }
    };
    this._itemDataCache.set(id, data);
    if (attributes && localId !== null) {
      const itemAttrs = this.getItemAttributes(id);
      for (const [key, value] of Object.entries(itemAttrs ?? {})) {
        if (allAttributes) {
          if (!attributesConfig?.includes(key)) {
            data[key] = value;
          }
        } else if (attributesConfig?.includes(key)) {
          data[key] = value;
        }
      }
    }
    if (relations) {
      const itemRels = this.getItemRelations(id);
      const { deletedItems } = this._virtualModel.requestIndex;
      for (const [key, localIds] of Object.entries(itemRels ?? {})) {
        for (const localId2 of localIds) {
          if (deletedItems.has(localId2)) {
            continue;
          }
          const itemData = this.getItemData(localId2, {
            parentName: rel,
            rel: key
          });
          if (Object.keys(itemData).length === 0) {
            continue;
          }
          const info = data[key];
          if (Array.isArray(info)) {
            info.push(itemData);
          } else {
            data[key] = [itemData];
          }
        }
      }
    }
    return data;
  }
  getItemsData(ids, config = {}) {
    this._itemDataCache.clear();
    const result = [];
    const _ids = ids.length !== 0 ? ids : this._model.localIdsArray();
    if (!_ids) return result;
    this._itemDataConfig = {
      ...this._itemDataConfig,
      ...config
    };
    for (const id of _ids) {
      result.push(this.getItemData(id));
    }
    this._itemDataCache.clear();
    this._itemDataConfig = {
      relationsDefault: { attributes: false, relations: false },
      attributesDefault: true
    };
    return result;
  }
  getRawRelations(ids) {
    const source = new Set(ids ?? this.getLocalIds());
    const result = /* @__PURE__ */ new Map();
    for (const id of source) {
      const found = this.getItemRelations(id);
      if (found) {
        result.set(id, { data: found });
      }
    }
    return result;
  }
  getItemRelations(id) {
    const isLocalId = typeof id === "number";
    const localId = isLocalId ? id : this.getLocalIdsByGuids([id])[0];
    if (localId === null) {
      return null;
    }
    const edited = this._virtualModel.requestIndex.latest(
      localId,
      EditRequestType.UPDATE_RELATION,
      EditRequestType.CREATE_RELATION
    );
    if (edited) {
      return edited.data.data;
    }
    const relations = this._relations.get(localId) ?? {};
    const index = this.indexOfRelationsItem(localId);
    if (index === void 0 || index === -1) {
      return Object.keys(relations).length > 0 ? relations : null;
    }
    const buffer = this._model.relations(index);
    if (!buffer) {
      return Object.keys(relations).length > 0 ? relations : null;
    }
    for (let j = 0; j < buffer.dataLength(); j++) {
      const attr = buffer.data(j);
      if (!attr) {
        continue;
      }
      const [name, ...localIds] = JSON.parse(attr);
      relations[name] = localIds;
    }
    return relations;
  }
  getCategories() {
    const categories = /* @__PURE__ */ new Set();
    for (let index = 0; index < this._model.categoriesLength(); index++) {
      const category = this._model.categories(index);
      if (!category) continue;
      categories.add(category);
    }
    for (let i = 0; i < this._virtualModel.requests.length; i++) {
      const request = this._virtualModel.requests[i];
      if (request.type === EditRequestType.CREATE_ITEM || request.type === EditRequestType.UPDATE_ITEM) {
        if (request.data.category) {
          categories.add(request.data.category);
        }
      }
    }
    return [...categories];
  }
  // Improve this with an indexation at runtime?
  // It already runs fast enough (?)
  getItemsOfCategories(categories) {
    const result = {};
    const deletedItems = /* @__PURE__ */ new Set();
    for (const request of this._virtualModel.requests) {
      if (request.type === EditRequestType.DELETE_ITEM) {
        deletedItems.add(request.localId);
      }
    }
    for (const request of this._virtualModel.requests) {
      if (request.type === EditRequestType.CREATE_ITEM || request.type === EditRequestType.UPDATE_ITEM) {
        if (deletedItems.has(request.localId)) {
          continue;
        }
        for (const categoryRegex of categories) {
          if (categoryRegex.test(request.data.category)) {
            if (!result[request.data.category]) {
              result[request.data.category] = [];
            }
            result[request.data.category].push(request.localId);
          }
        }
      }
    }
    const catIndex = this.getCategoryIndex();
    for (const [currentCategory, ids] of catIndex) {
      for (const categoryRegex of categories) {
        if (categoryRegex.test(currentCategory)) {
          if (!result[currentCategory]) {
            result[currentCategory] = [];
          }
          const target = result[currentCategory];
          if (deletedItems.size > 0) {
            for (const localId of ids) {
              if (!deletedItems.has(localId)) target.push(localId);
            }
          } else {
            for (const localId of ids) target.push(localId);
          }
          break;
        }
      }
    }
    return result;
  }
  _categoryIndexCache = null;
  /**
   * Lazily built category → localIds index over the immutable flatbuffer
   * data. Keyed by the underlying buffer and length so it rebuilds if the
   * model buffer is regenerated. Items created/updated/deleted via edit
   * requests are handled by the callers on top of this index.
   */
  getCategoryIndex() {
    const arr = this._model.localIdsArray();
    const length = this._model.categoriesLength();
    let cache = this._categoryIndexCache;
    if (!cache || cache.length !== length || arr && cache.buffer !== arr.buffer) {
      const map = /* @__PURE__ */ new Map();
      for (let index = 0; index < length; index++) {
        const currentCategory = this._model.categories(index);
        if (!currentCategory) continue;
        const localId = this._model.localIds(index);
        let ids = map.get(currentCategory);
        if (!ids) {
          ids = [];
          map.set(currentCategory, ids);
        }
        ids.push(localId);
      }
      cache = { buffer: arr ? arr.buffer : null, length, map };
      this._categoryIndexCache = cache;
    }
    return cache.map;
  }
  getItemsWithGeometry() {
    const meshes = this._model.meshes(new Meshes());
    const localIds = [];
    if (!meshes) {
      return localIds;
    }
    const indices = meshes.meshesItemsArray();
    if (!indices) {
      return localIds;
    }
    for (const index of indices) {
      const localId = this._model.localIds(index);
      if (localId === null) {
        continue;
      }
      localIds.push(localId);
    }
    return localIds;
  }
  getItemsWithGeometryCategories() {
    const localIds = this.getItemsWithGeometry();
    const categories = this.getItemsCategories(localIds);
    return categories;
  }
  checkAttribute(attr, {
    name,
    value,
    type
  }) {
    const { name: attrName, value: val, type: typeValue } = attr;
    let pass = false;
    if (name.test(attrName)) {
      pass = value === void 0 && type === void 0;
      if (!pass) {
        if (value !== void 0) {
          if (Array.isArray(value)) {
            pass = value.some(
              (regex) => typeof val === "string" && regex.test(val)
            );
          } else if (value instanceof RegExp) {
            pass = typeof val === "string" && value.test(val);
          } else {
            pass = val === value;
          }
        }
        if (type !== void 0) {
          pass = pass && typeof typeValue === "string" && type.test(typeValue);
        }
      }
    }
    return pass;
  }
  getItemsByAttribute({
    name,
    value,
    type,
    negate,
    itemIds
  }) {
    const allAttributesLength = this._model.attributesLength();
    const res = [];
    const missingItemsToIterate = new Set(itemIds);
    const itemIdSet = itemIds?.length ? new Set(itemIds) : null;
    for (let i = 0; i < allAttributesLength; i++) {
      const localId = this._model.localIds(i);
      if (localId === null) continue;
      missingItemsToIterate.delete(localId);
      if (itemIdSet && !itemIdSet.has(localId)) continue;
      const attribute = this._model.attributes(i);
      if (!attribute) continue;
      const dataLength = attribute?.dataLength();
      let itemPasses = false;
      for (let j = 0; j < dataLength; j++) {
        const data = attribute.data(j);
        if (!data) continue;
        const [attrName, val, typeValue] = JSON.parse(data);
        const pass = this.checkAttribute(
          {
            name: attrName,
            value: val,
            type: typeValue
          },
          { name, value, type }
        );
        if (pass) {
          itemPasses = true;
          break;
        }
      }
      if (negate ? !itemPasses : itemPasses) {
        res.push(localId);
      }
    }
    if (!itemIds) {
      for (let i = this._virtualModel.requests.length - 1; i >= 0; i--) {
        const request = this._virtualModel.requests[i];
        if (request.type === EditRequestType.CREATE_ITEM && request.localId !== void 0) {
          const data = {};
          for (const name2 in request.data.data) {
            const found = request.data.data[name2];
            data[name2] = { value: found.value, type: found.type };
          }
          let itemPasses = false;
          for (const [
            attrName,
            { value: val, type: typeValue }
          ] of Object.entries(data)) {
            const pass = this.checkAttribute(
              {
                name: attrName,
                value: val,
                type: typeValue
              },
              { name, value, type }
            );
            if (pass) {
              itemPasses = true;
              break;
            }
          }
          if (negate ? !itemPasses : itemPasses) {
            res.push(Number(request.localId));
          }
        }
      }
    } else {
      for (const localId of missingItemsToIterate) {
        const created = this._virtualModel.requestIndex.latest(
          localId,
          EditRequestType.CREATE_ITEM
        );
        if (!created) continue;
        const data = {};
        for (const name2 in created.data.data) {
          const found = created.data.data[name2];
          data[name2] = { value: found.value, type: found.type };
        }
        let itemPasses = false;
        for (const [
          attrName,
          { value: val, type: typeValue }
        ] of Object.entries(data)) {
          const pass = this.checkAttribute(
            {
              name: attrName,
              value: val,
              type: typeValue
            },
            { name, value, type }
          );
          if (pass) {
            itemPasses = true;
            break;
          }
        }
        if (negate ? !itemPasses : itemPasses) {
          res.push(localId);
        }
      }
    }
    return res;
  }
  getItemsByRelation({
    name,
    targetItemIds,
    sourceItemIds
  }) {
    const res = [];
    const sources = sourceItemIds ?? this.getAllLocalIds();
    for (const srcId of sources) {
      const rels = this.getItemRelations(srcId);
      const linked = rels?.[name];
      if (!linked) continue;
      if (targetItemIds) {
        for (const trgId of linked) {
          if (targetItemIds.has(trgId)) {
            res.push(srcId);
            break;
          }
        }
      } else {
        res.push(srcId);
      }
    }
    return res;
  }
  getItemsByQuery(params, config) {
    const { categories, attributes, relation } = params;
    let candidateIds = config?.localIds;
    if (candidateIds) {
      if (categories) {
        const itemsCategories = this.getItemsCategories(candidateIds);
        candidateIds = candidateIds.filter((_, index) => {
          const category = itemsCategories[index];
          if (!category) return null;
          return categories.some((entry) => entry.test(category));
        });
      }
    } else {
      candidateIds = categories?.filter(Boolean)?.length ? Object.values(this.getItemsOfCategories(categories)).flat() : void 0;
    }
    if (candidateIds?.length === 0) return [];
    if (attributes) {
      const aggregation = attributes.aggregation ?? "exclusive";
      const ids = [];
      for (const attribute of attributes.queries) {
        if (attributes && Boolean(attribute.name)) {
          const localIds = this.getItemsByAttribute({
            ...attribute,
            itemIds: candidateIds
          });
          ids.push(localIds);
        }
      }
      const set = /* @__PURE__ */ new Set();
      if (aggregation === "inclusive") {
        for (const collection of ids) {
          for (const id of collection) {
            set.add(id);
          }
        }
      } else {
        const map = /* @__PURE__ */ new Map();
        for (const collection of ids) {
          for (const id of collection) {
            const count = map.get(id);
            if (count === void 0) {
              map.set(id, 1);
            } else {
              map.set(id, count + 1);
            }
          }
        }
        for (const [id, count] of map) {
          if (count === ids.length) {
            set.add(id);
          }
        }
      }
      candidateIds = [...set];
    }
    if (candidateIds?.length === 0) return [];
    if (relation && Boolean(relation.name)) {
      const { name, query } = relation;
      const targetIds = query ? new Set(this.getItemsByQuery(query)) : void 0;
      candidateIds = this.getItemsByRelation({
        name,
        targetItemIds: targetIds,
        sourceItemIds: candidateIds
      });
    }
    return Array.from(new Set(candidateIds));
  }
  getTreeItem(item) {
    const tree = {
      category: item.category(),
      localId: item.localId()
    };
    const children = [];
    for (let i = 0; i < item.childrenLength(); i++) {
      const child = item.children(i);
      if (!child) {
        continue;
      }
      children.push(this.getTreeItem(child));
    }
    if (children.length > 0) {
      tree.children = children;
    }
    return tree;
  }
  preindexGeometryIds() {
    const geometries = this._model.meshes();
    const length = geometries.meshesItemsLength();
    for (let i = 0; i < length; i++) {
      const localIdIndex = geometries.meshesItems(i);
      const localId = this._model.localIds(localIdIndex);
      if (localId === null) continue;
      if (!this._localIdsToGeometryIds.has(localId)) {
        this._localIdsToGeometryIds.set(localId, []);
      }
      this._localIdsToGeometryIds.get(localId).push(i);
    }
  }
  convertToLocalId(id) {
    const isLocalId = typeof id === "number";
    if (isLocalId) return id;
    const localId = this._guidToLocalIdMap.get(id);
    if (localId === void 0) return null;
    return localId;
  }
  getChildrenLocalIds(treeItem, collector) {
    if (treeItem.localId !== null) {
      collector.add(treeItem.localId);
    }
    if (treeItem.children) {
      for (const child of treeItem.children) {
        this.getChildrenLocalIds(child, collector);
      }
    }
  }
  traverseSpatialStructure(localId, collector, treeItem = this.getSpatialStructure()) {
    if (!treeItem) return;
    if (treeItem.localId === localId && treeItem.children) {
      for (const child of treeItem.children) {
        this.getChildrenLocalIds(child, collector);
      }
      return;
    }
    if (treeItem.children) {
      for (const child of treeItem.children) {
        this.traverseSpatialStructure(localId, collector, child);
      }
    }
  }
}
export {
  VirtualPropertiesController
};
//# sourceMappingURL=virtual-properties-controller.mjs.map
