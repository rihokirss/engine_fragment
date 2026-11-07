function getObject(obj, result) {
  const proto = Object.getPrototypeOf(obj);
  const propNames = Object.getOwnPropertyNames(proto);
  for (const name of propNames) {
    if (name === "constructor" || name === "__init") continue;
    if (name.includes("mutate_")) continue;
    if (name.match(/.*Array$/)) continue;
    const value = proto[name];
    if (typeof value === "function") {
      const isArray = obj[`${name}Length`] !== void 0 && obj[`${name}Array`] !== void 0;
      if (value.length === 2 || isArray) {
        const lengthName = `${name}Length`;
        const length = obj[lengthName]();
        const array = [];
        result[name] = array;
        for (let i = 0; i < length; i++) {
          const found2 = obj[name](i);
          if (typeof found2 === "object" && found2 !== null && "bb" in found2) {
            const object = {};
            getObject(found2, object);
            array.push(object);
          } else {
            array.push(found2);
          }
        }
        continue;
      }
      const found = obj[name]();
      if (typeof found !== "object" || found === null) {
        result[name] = found;
        continue;
      }
      result[name] = {};
      getObject(found, result[name]);
    } else {
      result[name] = value;
    }
  }
}
export {
  getObject
};
//# sourceMappingURL=flatbuffers-json-converter.mjs.map
