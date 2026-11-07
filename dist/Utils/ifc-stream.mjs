import * as WEBIFC from "web-ifc";
import { extractLineMeta, parseStepArguments } from "./ifc-parsing-utils.mjs";
const crCharCode = 13;
const nl = "\n";
class IfcDecoderStream extends TransformStream {
  constructor(encoding = "utf-8") {
    let tail = "";
    const decoder = new TextDecoder(encoding);
    super({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        if (!text) return;
        let start = 0;
        let idx = text.indexOf(nl);
        if (idx !== -1) {
          let end = idx;
          if (end > 0 && text.charCodeAt(end - 1) === crCharCode) end--;
          else if (end === 0 && tail.charCodeAt(tail.length - 1) === crCharCode)
            tail = tail.slice(0, -1);
          controller.enqueue(
            tail ? tail + text.substring(start, end) : text.substring(start, end)
          );
          tail = "";
          start = idx + 1;
          idx = text.indexOf(nl, start);
        } else {
          tail += text;
          return;
        }
        while (idx !== -1) {
          let end = idx;
          if (end > start && text.charCodeAt(end - 1) === crCharCode) end--;
          controller.enqueue(text.substring(start, end));
          start = idx + 1;
          idx = text.indexOf(nl, start);
        }
        if (start < text.length) tail = text.substring(start);
      },
      flush(controller) {
        const remaining = decoder.decode();
        const full = tail + remaining;
        if (full) controller.enqueue(full);
      }
    });
  }
}
const maxStatementLength = 64 * 1024 * 1024;
class IfcParserStream extends TransformStream {
  constructor() {
    let factories = null;
    let fileSchemas = null;
    let section = "header";
    let statement = "";
    let inString = false;
    let inComment = false;
    function processStatement(raw, controller) {
      switch (section) {
        case "header":
          if (raw === "DATA") {
            if (!fileSchemas) {
              controller.error(new Error("Ifc schema not found"));
              return;
            }
            let schemaIndex = -1;
            for (const name of fileSchemas) {
              schemaIndex = WEBIFC.SchemaNames.findIndex(
                (names) => names?.includes(name)
              );
              if (schemaIndex !== -1) break;
            }
            if (schemaIndex === -1) {
              controller.error(
                new Error(`Ifc schema '${fileSchemas.join("', '")}' not found`)
              );
              return;
            }
            factories = WEBIFC.FromRawLineData[schemaIndex];
            section = "data";
          } else if (raw.startsWith("FILE_SCHEMA")) {
            try {
              const [names] = parseStepArguments(raw);
              if (Array.isArray(names)) {
                const schemas = [];
                for (const item of names) {
                  if (item && !Array.isArray(item) && typeof item.value === "string") {
                    schemas.push(item.value);
                  }
                }
                if (schemas.length) fileSchemas = schemas;
              }
            } catch {
            }
          }
          break;
        case "data": {
          if (raw === "ENDSEC") {
            section = "between";
            return;
          }
          const meta = extractLineMeta(raw);
          if (!meta) {
            controller.error(new Error(`Corrupted Ifc statement: ${raw}`));
            return;
          }
          const typeCode = WEBIFC[meta.type];
          if (typeof typeCode !== "number") return;
          const factory = factories?.[typeCode];
          if (!factory) return;
          let entity;
          try {
            entity = factory(parseStepArguments(raw));
          } catch (err) {
            controller.error(
              new Error(`Corrupted Ifc statement: ${raw}`, { cause: err })
            );
            return;
          }
          entity.expressID = meta.id;
          controller.enqueue(entity);
          break;
        }
        case "between":
          if (raw === "DATA") section = "data";
          else if (raw === "END-ISO-10303-21") section = "end";
          break;
      }
    }
    super({
      transform(line, controller) {
        const length = line.length;
        let segStart = 0;
        let i = 0;
        while (i < length) {
          const c = line.charCodeAt(i);
          if (inComment) {
            if (c === 42 && line.charCodeAt(i + 1) === 47) {
              inComment = false;
              i += 2;
              segStart = i;
            } else i++;
            continue;
          }
          if (inString) {
            if (c === 39) inString = false;
            i++;
            continue;
          }
          if (c === 39) {
            inString = true;
            i++;
            continue;
          }
          if (c === 47 && line.charCodeAt(i + 1) === 42) {
            statement += `${line.substring(segStart, i)} `;
            inComment = true;
            i += 2;
            continue;
          }
          if (c === 59) {
            const raw = (statement + line.substring(segStart, i)).trim();
            statement = "";
            i++;
            segStart = i;
            if (raw) processStatement(raw, controller);
            continue;
          }
          i++;
        }
        if (!inComment && segStart < length) {
          statement += `${line.substring(segStart)}
`;
          if (statement.length > maxStatementLength) {
            controller.error(new Error("Ifc statement exceeds maximum length"));
          }
        }
      },
      flush(controller) {
        if (statement.trim() || section !== "end") {
          controller.error(new Error("Unexpected end of Ifc stream"));
        }
      }
    });
  }
}
async function* streamAsyncIterator(stream) {
  const reader = stream.getReader();
  let drained = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        drained = true;
        return;
      }
      yield value;
    }
  } finally {
    if (!drained) await reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
export {
  IfcDecoderStream,
  IfcParserStream,
  streamAsyncIterator
};
//# sourceMappingURL=ifc-stream.mjs.map
