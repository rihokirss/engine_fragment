import * as WEBIFC from "web-ifc";
let classNames = null;
function getClassNames() {
  if (classNames) return classNames;
  classNames = /* @__PURE__ */ new Map();
  const schemas = [WEBIFC.IFC2X3, WEBIFC.IFC4, WEBIFC.IFC4X3];
  for (const schema of schemas) {
    if (!schema || typeof schema !== "object") continue;
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value !== "function" || classNames.has(value)) continue;
      classNames.set(value, key.toUpperCase());
    }
  }
  return classNames;
}
function ifcValueTypeName(value) {
  if (!value || typeof value !== "object") return void 0;
  const own = value.name;
  if (typeof own === "string" && own) return own;
  return getClassNames().get(value.constructor);
}
export {
  ifcValueTypeName
};
//# sourceMappingURL=value-type-name.mjs.map
