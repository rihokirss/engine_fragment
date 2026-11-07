async function toClassicWorker(workerURL) {
  const res = await fetch(workerURL);
  const src = await res.text();
  const classic = src.replace(/export\s*\{[^}]*\}\s*;?\s*/, "");
  const blob = new Blob([classic], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}
export {
  toClassicWorker
};
//# sourceMappingURL=worker-utils.mjs.map
