import * as WEBIFC from "web-ifc";
import { ifcValueTypeName } from "./value-type-name.mjs";
import { ifcCategoryMap } from "../../../../Utils/ifc-category-map.mjs";
import { ALIGNMENT_CATEGORY, GRID_CATEGORY } from "../../../../FragmentsModels/src/model/model-types.mjs";
import { FragmentsIfcUtils } from "../../../../Utils/ifc-utils.mjs";
import { getProvenanceMetadata } from "../../../../Utils/version.mjs";
import { Model } from "../../../../Schema/model.mjs";
import { Attribute } from "../../../../Schema/attribute.mjs";
import { Relation } from "../../../../Schema/relation.mjs";
import { SpatialStructure } from "../../../../Schema/spatial-structure.mjs";
class IfcPropertyProcessor {
  constructor(_serializer, _builder) {
    this._serializer = _serializer;
    this._builder = _builder;
  }
  _serializer;
  _builder;
  _lengthUnitsFactor = 1;
  _attributesOffsets = [];
  _relationsMap = {};
  // Tracks entities already placed in the spatial structure so an item
  // reachable by more than one relation (e.g. an alignment aggregated to the
  // project and also referenced by a bridge) is listed once, not duplicated.
  _spatialVisited = /* @__PURE__ */ new Set();
  _guids = [];
  _guidsItems = [];
  _uniqueAttributes = /* @__PURE__ */ new Set();
  _uniqueRelNames = /* @__PURE__ */ new Set();
  _maxLocalID = 0;
  _ifcApi = null;
  _modelOpen = false;
  wasm = {
    path: "/node_modules/web-ifc/",
    absolute: false
  };
  webIfcSettings = {};
  expressIDs = [];
  classes = [];
  async getIfcApi() {
    if (!this._ifcApi) {
      const ifcApi = new WEBIFC.IfcAPI();
      ifcApi.SetWasmPath(this.wasm.path, this.wasm.absolute);
      await ifcApi.Init();
      ifcApi.SetLogLevel(WEBIFC.LogLevel.LOG_LEVEL_OFF);
      this._ifcApi = ifcApi;
    }
    return this._ifcApi;
  }
  /**
   * Reads properties from an already open web-ifc model instead of the file.
   * @remarks The model must have ID 0. The processor disposes the instance
   * when it finishes.
   */
  useOpenModel(ifcApi) {
    ifcApi.SetLogLevel(WEBIFC.LogLevel.LOG_LEVEL_OFF);
    this._ifcApi = ifcApi;
    this._modelOpen = true;
  }
  async getSchema(modelId = 0) {
    const ifcApi = await this.getIfcApi();
    const schema = ifcApi.GetModelSchema(modelId);
    if (!schema) {
      throw new Error("Fragments: IFC Schema not found");
    }
    if (schema.startsWith("IFC2X3")) {
      return "IFC2X3";
    }
    if (schema.startsWith("IFC4") && schema.replace("IFC4", "") === "") {
      return "IFC4";
    }
    if (schema.startsWith("IFC4X")) {
      return "IFC4X3";
    }
    return schema;
  }
  unwrapValue(value) {
    if (value === null || value === void 0) {
      return value;
    }
    if (typeof value === "object" && "value" in value) {
      return this.unwrapValue(value.value);
    }
    return value;
  }
  async process(data) {
    const ifcApi = await this.getIfcApi();
    this._maxLocalID = data.maxLocalID + 1;
    if (this._modelOpen) ;
    else if (data.readFromCallback && data.readCallback) {
      ifcApi.OpenModelFromCallback(data.readCallback, this.webIfcSettings);
    } else if (data.bytes) {
      await ifcApi.OpenModel(data.bytes, this.webIfcSettings);
    } else {
      throw new Error("Fragments: No data provided");
    }
    if (this._serializer.replaceStoreyElevation) {
      await this.setLengthUnitsFactor();
    }
    const modelClasses = ifcApi.GetAllTypesOfModel(0).map((entry) => entry.typeID);
    const schema = await this.getSchema();
    const schemaNamespace = WEBIFC[schema];
    if (!schemaNamespace) {
      throw new Error(`Fragments: Model schema not recognized.`);
    }
    const itemsWithGeom = data.geometryProcessedLocalIDs;
    await this.processItems(itemsWithGeom);
    const visitedItems = new Set(itemsWithGeom);
    data.progressCallback?.(0.6, {
      process: "attributes",
      state: "start",
      entitiesProcessed: itemsWithGeom.length
    });
    const classes = /* @__PURE__ */ new Set([
      ...this._serializer.classes.abstract,
      ...this._serializer.classes.elements
    ]);
    const toProcess = modelClasses.filter((type) => classes.has(type));
    const categoryPercentage = 0.15 / toProcess.length;
    for (const [index, entityClass] of toProcess.entries()) {
      const classEntities = ifcApi.GetLineIDsWithType(0, entityClass);
      if (classEntities.size() === 0) continue;
      const items = [];
      for (let index2 = 0; index2 < classEntities.size(); index2++) {
        const id = classEntities.get(index2);
        if (visitedItems.has(id)) continue;
        items.push(id);
      }
      if (items.length === 0) continue;
      await this.processItems(items);
      data.progressCallback?.(categoryPercentage * (index + 1) + 0.6, {
        process: "attributes",
        state: index + 1 === toProcess.length ? "finish" : "inProgress",
        class: ifcCategoryMap[entityClass],
        entitiesProcessed: items.length
      });
    }
    const alignments = data.alignments;
    if (alignments) {
      this.processCustomItems(alignments, ALIGNMENT_CATEGORY);
    }
    const grids = data.grids;
    if (grids) {
      this.processCustomItems(grids, GRID_CATEGORY);
    }
    const relations = /* @__PURE__ */ new Set([...this._serializer.relations.keys()]);
    const relsToProcess = modelClasses.filter((type) => relations.has(type));
    const relsPercentage = 0.15 / relsToProcess.length;
    for (const [index, rel] of relsToProcess.entries()) {
      const state = (() => {
        if (index === 0) return "start";
        if (index + 1 === relsToProcess.length) return "finish";
        return "inProgress";
      })();
      await this.processRelations([rel]);
      data.progressCallback?.(relsPercentage * (index + 1) + 0.75, {
        process: "relations",
        state,
        class: ifcCategoryMap[rel]
      });
    }
    const { relIndicesVector, relsVector } = this.getRelationsVector();
    const { guidsVector, guidsItemsVector } = this.getGuidsVector();
    const metadataOffset = await this.getMetadataOffset();
    const attributesVector = this.getAttributesVector();
    const uniqueAttributesVector = this.getUniqueAttributesVector();
    const relNamesVector = this.getRelNamesVector();
    const localIdsVector = Model.createLocalIdsVector(
      this._builder,
      this.expressIDs
    );
    const categoriesVector = this.getCategoriesVector();
    const spatialStrutureOffset = await this.getSpatialStructureOffset();
    this.clean();
    return {
      relIndicesVector,
      relsVector,
      guidsVector,
      guidsItemsVector,
      metadataOffset,
      attributesVector,
      localIdsVector,
      categoriesVector,
      spatialStrutureOffset,
      uniqueAttributesVector,
      relNamesVector,
      newMaxLocalID: this._maxLocalID
    };
  }
  async processItems(items) {
    const ifcApi = await this.getIfcApi();
    for (let index = 0; index < items.length; index++) {
      const expressID = items[index];
      try {
        const attrs = ifcApi.GetLine(0, expressID);
        if (!attrs) continue;
        const className = ifcCategoryMap[attrs.type];
        this.classes.push(className);
        this.expressIDs.push(expressID);
        await this.serializeAttributes(expressID, attrs);
        if (this._serializer.includeMaterialProperties) {
          this.addMaterialPropertiesInverse(expressID, attrs);
        }
      } catch (e) {
        console.log(
          `Problem reading properties for ${expressID}. If many items are problematic, it may be a problem with the category you are trying to process. You can remove it and try again.`
        );
        console.log(e);
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });
        continue;
      }
    }
  }
  async processCustomItems(customItems, category) {
    for (const customItem of customItems) {
      const expressID = this._maxLocalID++;
      const attrValue = JSON.stringify(customItem);
      const attrName = "data";
      const attrType = "UNDEFINED";
      const hash = JSON.stringify([attrName, attrValue, attrType]);
      const attrOffset = this._builder.createSharedString(hash);
      if (this._serializer.includeUniqueAttributes) {
        this._uniqueAttributes.add(hash);
      }
      const dataVector = Attribute.createDataVector(this._builder, [
        attrOffset
      ]);
      const attributesOffset = Attribute.createAttribute(
        this._builder,
        dataVector
      );
      this.classes.push(category);
      this.expressIDs.push(expressID);
      this._attributesOffsets.push(attributesOffset);
    }
  }
  // `IfcMaterial.HasProperties` is the IFC4 inverse of
  // `IfcMaterialProperties.Material` (and of the IFC2X3
  // `IfcExtendedMaterialProperties` subtype). web-ifc only exposes the forward
  // `Material` reference, and the generic attribute pass records just that
  // direction, so without this the material's properties are serialized but
  // unreachable from an element. Synthesize the inverse on the material so the
  // path element -> HasAssociations -> material -> HasProperties -> material
  // properties works (issue #249). No-op for anything that isn't material
  // properties, so it's safe to call for every processed item.
  addMaterialPropertiesInverse(expressID, attrs) {
    const type = attrs.type;
    if (type !== WEBIFC.IFCMATERIALPROPERTIES && type !== WEBIFC.IFCEXTENDEDMATERIALPROPERTIES) {
      return;
    }
    const material = attrs.Material;
    const materialID = material && typeof material === "object" && "value" in material ? material.value : void 0;
    if (typeof materialID === "number") {
      this.addRelation(materialID, "HasProperties", [expressID]);
    }
  }
  addRelation(expressID, relName, ids) {
    if (!this._relationsMap[expressID]) this._relationsMap[expressID] = {};
    if (!this._relationsMap[expressID][relName])
      this._relationsMap[expressID][relName] = [];
    for (const id of ids) {
      this._relationsMap[expressID][relName].push(id);
    }
    if (this._serializer.includeRelationNames) {
      this._uniqueRelNames.add(relName);
    }
  }
  async getAbsoluteElevation(placement, height) {
    const ifcApi = await this.getIfcApi();
    const localPlacementAttrs = ifcApi.GetLine(0, placement);
    let relPlacementAttrs;
    if (localPlacementAttrs?.RelativePlacement && "value" in localPlacementAttrs.RelativePlacement && typeof localPlacementAttrs.RelativePlacement.value === "number") {
      relPlacementAttrs = ifcApi.GetLine(
        0,
        localPlacementAttrs.RelativePlacement.value
      );
    }
    let locationAttrs;
    if (relPlacementAttrs?.Location && "value" in relPlacementAttrs.Location && typeof relPlacementAttrs.Location.value === "number") {
      locationAttrs = ifcApi.GetLine(0, relPlacementAttrs.Location.value);
    }
    if (locationAttrs?.Coordinates && Array.isArray(locationAttrs.Coordinates) && "value" in locationAttrs.Coordinates[2] && typeof locationAttrs.Coordinates[2].value === "number") {
      height.value += locationAttrs.Coordinates[2].value;
    }
    if (localPlacementAttrs?.PlacementRelTo && "value" in localPlacementAttrs.PlacementRelTo && typeof localPlacementAttrs.PlacementRelTo.value === "number") {
      await this.getAbsoluteElevation(
        localPlacementAttrs.PlacementRelTo.value,
        height
      );
    }
  }
  async setLengthUnitsFactor() {
    const ifcApi = await this.getIfcApi();
    this._lengthUnitsFactor = FragmentsIfcUtils.getUnitsFactor(ifcApi);
  }
  async serializeAttributes(expressID, attrs) {
    const attrOffsets = [];
    let guid = null;
    if (this._serializer.replaceSiteElevation && attrs.type && typeof attrs.type === "number" && attrs.type === WEBIFC.IFCSITE && attrs.ObjectPlacement && "value" in attrs.ObjectPlacement && typeof attrs.ObjectPlacement.value === "number") {
      const height = { value: 0 };
      await this.getAbsoluteElevation(attrs.ObjectPlacement.value, height);
      attrs.RefElevation = new WEBIFC.IFC4X3.IfcLengthMeasure(
        height.value * this._lengthUnitsFactor
      );
    }
    if (this._serializer.replaceStoreyElevation && attrs.type && typeof attrs.type === "number" && attrs.type === WEBIFC.IFCBUILDINGSTOREY && attrs.ObjectPlacement && "value" in attrs.ObjectPlacement && typeof attrs.ObjectPlacement.value === "number") {
      const height = { value: 0 };
      await this.getAbsoluteElevation(attrs.ObjectPlacement.value, height);
      attrs.Elevation = new WEBIFC.IFC4X3.IfcLengthMeasure(
        height.value * this._lengthUnitsFactor
      );
    }
    for (const [attrName, attrValue] of Object.entries(attrs)) {
      if (typeof attrValue === "number" || typeof attrValue === "boolean")
        continue;
      if (this._serializer.attributesToExclude.has(attrName) || attrValue === null || attrValue === void 0) {
        continue;
      }
      if (Array.isArray(attrValue)) {
        const noHandles = attrValue.filter((handle) => handle.type !== 5);
        if (noHandles.length > 0) {
          const noHandlesValue = noHandles.map(
            (handle) => this.unwrapValue(handle.value)
          );
          const attrData = [attrName, noHandlesValue];
          attrData.push(ifcValueTypeName(noHandles[0]) ?? "UNDEFINED");
          const hash = JSON.stringify(attrData);
          const attrOffset = this._builder.createSharedString(hash);
          attrOffsets.push(attrOffset);
        }
        const handles = attrValue.filter((handle) => handle.type === 5);
        const ids = handles.map((handle) => handle.value);
        this.addRelation(expressID, attrName, ids);
        continue;
      }
      let value;
      let type;
      if (typeof attrValue === "object" && attrValue !== null && "type" in attrValue) {
        value = attrValue.value;
        type = attrValue.type;
      } else if (typeof attrValue === "string") {
        value = attrValue;
        type = void 0;
      } else {
        value = attrValue;
        type = void 0;
      }
      if (type === 5) {
        if (typeof value !== "number") continue;
        this.addRelation(expressID, attrName, [value]);
      } else {
        const unwrappedValue = this.unwrapValue(value);
        if (attrName === "GlobalId" && typeof unwrappedValue === "string") {
          guid = unwrappedValue;
          continue;
        }
        const attrData = [attrName, unwrappedValue];
        let dataTypeName = ifcValueTypeName(attrValue) ?? "UNDEFINED";
        if (dataTypeName === "UNDEFINED" || dataTypeName === "OBJECT") {
          if (typeof unwrappedValue === "number") {
            dataTypeName = Number.isInteger(unwrappedValue) ? "IFCINTEGER" : "IFCREAL";
          } else if (typeof unwrappedValue === "string") {
            dataTypeName = "IFCLABEL";
          } else if (typeof unwrappedValue === "boolean") {
            dataTypeName = "IFCBOOLEAN";
          }
        }
        attrData.push(dataTypeName);
        const hash = JSON.stringify(attrData);
        const attrOffset = this._builder.createSharedString(hash);
        attrOffsets.push(attrOffset);
        if (this._serializer.includeUniqueAttributes) {
          this._uniqueAttributes.add(hash);
        }
      }
    }
    const dataVector = Attribute.createDataVector(
      this._builder,
      attrOffsets
    );
    const attributeOffset = Attribute.createAttribute(
      this._builder,
      dataVector
    );
    this._attributesOffsets.push(attributeOffset);
    if (guid) {
      this._guids.push(guid);
      this._guidsItems.push(expressID);
    }
  }
  getAttributesVector() {
    const attributesVector = Model.createAttributesVector(
      this._builder,
      this._attributesOffsets
    );
    return attributesVector;
  }
  getUniqueAttributesVector() {
    const offsets = [];
    for (const hash of this._uniqueAttributes) {
      const offset = this._builder.createSharedString(hash);
      offsets.push(offset);
    }
    const uniqueAttributesVector = Model.createUniqueAttributesVector(
      this._builder,
      offsets
    );
    return uniqueAttributesVector;
  }
  getRelNamesVector() {
    const offsets = [];
    for (const name of this._uniqueRelNames) {
      const offset = this._builder.createSharedString(name);
      offsets.push(offset);
    }
    const relationNamesVector = Model.createRelationNamesVector(
      this._builder,
      offsets
    );
    return relationNamesVector;
  }
  getGuidsVector() {
    const guidOffsets = [];
    for (const guid of this._guids) {
      const offset = this._builder.createString(guid);
      guidOffsets.push(offset);
    }
    const guidsVector = Model.createGuidsVector(this._builder, guidOffsets);
    const guidsItemsVector = Model.createGuidsItemsVector(
      this._builder,
      this._guidsItems
    );
    return { guidsVector, guidsItemsVector };
  }
  async processRelations(rels) {
    const ifcApi = await this.getIfcApi();
    for (const entityClass of rels) {
      const relNames = this._serializer.relations.get(entityClass);
      if (!relNames) continue;
      const { forRelating, forRelated } = relNames;
      const classEntities = ifcApi.GetLineIDsWithType(0, entityClass);
      if (classEntities.size() === 0) continue;
      for (let index = 0; index < classEntities.size(); index++) {
        const expressID = classEntities.get(index);
        try {
          const attrs = ifcApi.GetLine(0, expressID);
          if (!attrs) continue;
          const attrKeys = Object.keys(attrs);
          const relatingKey = attrKeys.find(
            (attr) => attr.startsWith("Relating")
          );
          const relatedKey = attrKeys.find(
            (attr) => attr.startsWith("Related")
          );
          if (!(relatingKey && relatedKey)) continue;
          const relatingAttr = attrs[relatingKey];
          if (!relatingAttr || relatingAttr.value === void 0 || relatingAttr.value === null) {
            continue;
          }
          const relatingID = relatingAttr.value;
          const rawRelatedIDs = attrs[relatedKey];
          let relatedIDs = [];
          if (Array.isArray(rawRelatedIDs)) {
            relatedIDs = rawRelatedIDs.filter(
              (related) => related && related.value !== void 0 && related.value !== null
            ).map(({ value }) => value);
          } else if (rawRelatedIDs && rawRelatedIDs.value !== void 0 && rawRelatedIDs.value !== null) {
            relatedIDs = [rawRelatedIDs.value];
          }
          if (relatedIDs.length === 0) continue;
          this.addRelation(relatingID, forRelating, relatedIDs);
          for (const relatedID of relatedIDs) {
            this.addRelation(relatedID, forRelated, [relatingID]);
          }
        } catch (e) {
          console.log(`Problem reading relations for ${expressID}`);
          console.log(e);
          continue;
        }
      }
    }
  }
  getRelationsVector(clean = false) {
    const rels = [];
    const ids = [];
    for (const [expressID, entityRels] of Object.entries(this._relationsMap)) {
      if (clean && !this.expressIDs.includes(Number(expressID))) continue;
      const definitions = [];
      for (const [attrName, _rels] of Object.entries(entityRels)) {
        let rels2 = _rels;
        if (clean) {
          rels2 = _rels.filter((id) => this.expressIDs.includes(id));
          if (rels2.length === 0) continue;
        }
        const hash = JSON.stringify([attrName, ...rels2]);
        const offset = this._builder.createSharedString(hash);
        definitions.push(offset);
      }
      if (clean && definitions.length === 0) continue;
      ids.push(Number(expressID));
      const dataVector = Relation.createDataVector(
        this._builder,
        definitions
      );
      const relOffset = Relation.createRelation(this._builder, dataVector);
      rels.push(relOffset);
    }
    const relsVector = Model.createRelationsVector(this._builder, rels);
    const relIndicesVector = Model.createRelationsItemsVector(
      this._builder,
      ids
    );
    return { relIndicesVector, relsVector };
  }
  getCategoriesVector() {
    const classesOffset = this.classes.map(
      (name) => this._builder.createSharedString(name)
    );
    const categoriesVector = Model.createCategoriesVector(
      this._builder,
      classesOffset
    );
    return categoriesVector;
  }
  async getMetadataOffset() {
    const ifcApi = await this.getIfcApi();
    const schema = ifcApi.GetModelSchema(0);
    const rawNames = ifcApi.GetHeaderLine(0, WEBIFC.FILE_NAME);
    const rawDescription = ifcApi.GetHeaderLine(0, WEBIFC.FILE_DESCRIPTION);
    const names = [];
    this.getMetadataRecursively(rawNames.arguments, names);
    const descriptions = [];
    this.getMetadataRecursively(rawDescription.arguments, descriptions);
    const crs = this.extractCRS(ifcApi);
    const importSettings = this._serializer.includeImportSettings ? {
      version: 1,
      sourceCounts: Object.fromEntries(
        ifcApi.GetAllTypesOfModel(0).map(({ typeID }) => [
          ifcApi.GetNameFromTypeCode(typeID).toUpperCase(),
          ifcApi.GetLineIDsWithType(0, typeID).size()
        ])
      ),
      retainedCounts: this.classes.reduce(
        (counts, category) => {
          counts[category] = (counts[category] ?? 0) + 1;
          return counts;
        },
        {}
      ),
      excludedAttributes: [...this._serializer.attributesToExclude].sort(),
      relations: Object.fromEntries(this._serializer.relations),
      materialProperties: this._serializer.includeMaterialProperties
    } : void 0;
    const metadata = {
      schema,
      names,
      descriptions,
      crs,
      ...getProvenanceMetadata(),
      ...importSettings ? { importSettings } : {}
    };
    const metadataOffset = this._builder.createString(JSON.stringify(metadata));
    return metadataOffset;
  }
  extractCRS(ifcApi) {
    let crsEntity = null;
    try {
      const ids = ifcApi.GetLineIDsWithType(0, WEBIFC.IFCPROJECTEDCRS);
      if (ids.size() > 0) {
        crsEntity = ifcApi.GetLine(0, ids.get(0));
      }
    } catch {
    }
    if (!crsEntity) {
      try {
        const ids = ifcApi.GetLineIDsWithType(
          0,
          WEBIFC.IFCCOORDINATEREFERENCESYSTEM
        );
        if (ids.size() > 0) {
          crsEntity = ifcApi.GetLine(0, ids.get(0));
        }
      } catch {
      }
    }
    if (!crsEntity) {
      return null;
    }
    const name = this.unwrapValue(crsEntity.Name) ?? null;
    const description = this.unwrapValue(crsEntity.Description) ?? null;
    const geodeticDatum = this.unwrapValue(crsEntity.GeodeticDatum) ?? null;
    const verticalDatum = this.unwrapValue(crsEntity.VerticalDatum) ?? null;
    const mapProjection = this.unwrapValue(crsEntity.MapProjection) ?? null;
    const mapZone = this.unwrapValue(crsEntity.MapZone) ?? null;
    let mapUnit = null;
    try {
      const unitRef = crsEntity.MapUnit;
      if (unitRef && typeof unitRef === "object" && unitRef.type === 5) {
        const unitEntity = ifcApi.GetLine(0, unitRef.value);
        if (unitEntity) {
          const unitName = this.unwrapValue(unitEntity.Name);
          if (unitName) {
            mapUnit = String(unitName);
          }
        }
      }
    } catch {
    }
    let mapConversion = null;
    try {
      const convIds = ifcApi.GetLineIDsWithType(0, WEBIFC.IFCMAPCONVERSION);
      if (convIds.size() > 0) {
        const conv = ifcApi.GetLine(0, convIds.get(0));
        mapConversion = {
          eastings: this.unwrapValue(conv.Eastings) ?? 0,
          northings: this.unwrapValue(conv.Northings) ?? 0,
          orthogonalHeight: this.unwrapValue(conv.OrthogonalHeight) ?? 0,
          xAxisAbscissa: this.unwrapValue(conv.XAxisAbscissa) ?? 1,
          xAxisOrdinate: this.unwrapValue(conv.XAxisOrdinate) ?? 0,
          scale: this.unwrapValue(conv.Scale) ?? 1
        };
      }
    } catch {
    }
    return {
      name,
      description,
      geodeticDatum,
      verticalDatum,
      mapProjection,
      mapZone,
      mapUnit,
      mapConversion
    };
  }
  getMetadataRecursively(source, target) {
    for (const item of source) {
      if (item === null || item === void 0) continue;
      if (Array.isArray(item)) {
        this.getMetadataRecursively(item, target);
      }
      if ("value" in item && typeof item.value === "string") {
        target.push(item.value);
      }
    }
  }
  getEntityDecomposition(expressID, inverseAttributes) {
    const offsets = [];
    for (const attrName of inverseAttributes) {
      const relations = this._relationsMap[expressID]?.[attrName];
      if (!relations) continue;
      const entityGroups = {};
      for (const relatedID of relations) {
        if (this._spatialVisited.has(relatedID)) continue;
        const entityIndex = this.expressIDs.indexOf(relatedID);
        if (entityIndex === -1) continue;
        const entityClass = this.classes[entityIndex];
        if (!entityClass) continue;
        this._spatialVisited.add(relatedID);
        if (!entityGroups[entityClass]) entityGroups[entityClass] = [];
        entityGroups[entityClass].push(relatedID);
      }
      for (const category in entityGroups) {
        const entities = entityGroups[category];
        const childrenOffsets = entities.map(
          (id) => this.getEntityDecomposition(id, inverseAttributes)
        );
        const childrenVector2 = SpatialStructure.createChildrenVector(
          this._builder,
          childrenOffsets
        );
        const categoryOffset = this._builder.createSharedString(category);
        SpatialStructure.startSpatialStructure(this._builder);
        SpatialStructure.addCategory(this._builder, categoryOffset);
        SpatialStructure.addChildren(this._builder, childrenVector2);
        const offset2 = SpatialStructure.endSpatialStructure(this._builder);
        offsets.push(offset2);
      }
    }
    const childrenVector = SpatialStructure.createChildrenVector(
      this._builder,
      offsets
    );
    SpatialStructure.startSpatialStructure(this._builder);
    SpatialStructure.addLocalId(this._builder, expressID);
    SpatialStructure.addChildren(this._builder, childrenVector);
    const offset = SpatialStructure.endSpatialStructure(this._builder);
    return offset;
  }
  async getSpatialStructureOffset() {
    const ifcApi = await this.getIfcApi();
    const ifcClass = WEBIFC.IFCPROJECT;
    const classEntities = [...ifcApi.GetLineIDsWithType(0, ifcClass)];
    this._spatialVisited = new Set(classEntities);
    const childrenOffsets = classEntities.map(
      (id) => (
        // Beyond the classic containment/aggregation relations, we follow:
        //   - ReferencesElements (IfcRelReferencedInSpatialStructure): IFC4x3
        //     alignments attach to the spatial element (e.g. IfcBridge) by
        //     reference, not containment, so this is how IfcAlignment is reached.
        //   - IsNestedBy (IfcRelNests): IfcAlignment nests its
        //     IfcAlignmentHorizontal / IfcAlignmentVertical / IfcReferent, and
        //     those nest their segments, via IfcRelNests.
        // Without both, alignment layouts were absent from getSpatialStructure()
        // even though the items exist in the model (issue #743).
        this.getEntityDecomposition(id, [
          "IsDecomposedBy",
          "ContainsElements",
          "ReferencesElements",
          "IsNestedBy"
        ])
      )
    );
    const categoryOffset = this._builder.createSharedString("IFCPROJECT");
    const childrenVector = SpatialStructure.createChildrenVector(
      this._builder,
      childrenOffsets
    );
    SpatialStructure.startSpatialStructure(this._builder);
    SpatialStructure.addCategory(this._builder, categoryOffset);
    SpatialStructure.addChildren(this._builder, childrenVector);
    const offset = SpatialStructure.endSpatialStructure(this._builder);
    return offset;
  }
  clean() {
    this._ifcApi?.Dispose();
    this._ifcApi = null;
    this._modelOpen = false;
    this._guids = [];
    this._guidsItems = [];
    this._attributesOffsets = [];
    this._relationsMap = {};
    this._uniqueAttributes.clear();
    this._uniqueRelNames.clear();
    this.expressIDs = [];
    this.classes = [];
  }
}
export {
  IfcPropertyProcessor
};
//# sourceMappingURL=property-processor.mjs.map
