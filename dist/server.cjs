var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_stream = require("stream");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.options("/api/proxy-stream", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.sendStatus(200);
  });
  app.get("/api/proxy-stream", async (req, res) => {
    const streamUrl = req.query.url || req.query.stream;
    if (!streamUrl) {
      return res.status(400).send("url parameter is required");
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    try {
      const headersToForward = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*"
      };
      if (req.headers.range) {
        headersToForward["Range"] = req.headers.range;
      }
      const response = await fetch(streamUrl, {
        headers: headersToForward
      });
      if (!response.ok && response.status !== 206) {
        return res.status(response.status).send(`Failed to fetch media: ${response.statusText}`);
      }
      const contentType = response.headers.get("content-type") || "";
      const isPlaylist = streamUrl.toLowerCase().split("?")[0].endsWith(".m3u8") || streamUrl.toLowerCase().split("?")[0].endsWith(".m3u") || contentType.toLowerCase().includes("mpegurl") || contentType.toLowerCase().includes("mpegURL") || contentType.toLowerCase().includes("application/x-mpegurl");
      if (isPlaylist) {
        let protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        if (protocol.includes(",")) {
          protocol = protocol.split(",")[0].trim();
        }
        const proxyHost = req.get("host") || "localhost:3000";
        const proxyBase = `${protocol}://${proxyHost}/api/proxy-stream`;
        const text = await response.text();
        let baseUrl = streamUrl;
        try {
          const parsedUrl = new URL(streamUrl);
          baseUrl = parsedUrl.origin + parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf("/") + 1);
        } catch (e) {
          baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
        }
        const lines = text.split("\n");
        const rewrittenLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith("#")) {
            if (trimmed.includes("URI=")) {
              return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
                let absoluteUri = p1;
                if (!p1.startsWith("http://") && !p1.startsWith("https://")) {
                  try {
                    absoluteUri = new URL(p1, streamUrl).href;
                  } catch (e) {
                    absoluteUri = baseUrl + p1;
                  }
                }
                return `URI="${proxyBase}?url=${encodeURIComponent(absoluteUri)}"`;
              });
            }
            return line;
          }
          let absoluteUrl = trimmed;
          if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            try {
              absoluteUrl = new URL(trimmed, streamUrl).href;
            } catch (e) {
              absoluteUrl = baseUrl + trimmed;
            }
          }
          return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
        });
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache");
        return res.send(rewrittenLines.join("\n"));
      } else {
        res.status(response.status);
        const copyHeaders = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
        copyHeaders.forEach((h) => {
          const val = response.headers.get(h);
          if (val) {
            res.setHeader(h, val);
          }
        });
        if (!res.getHeader("content-type")) {
          res.setHeader("Content-Type", contentType || "video/mp2t");
        }
        if (response.body) {
          try {
            const readable = import_stream.Readable.fromWeb(response.body);
            readable.pipe(res);
          } catch (streamError) {
            console.error("Readable.fromWeb error, falling back:", streamError);
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
          }
        } else {
          const buffer = await response.arrayBuffer();
          res.send(Buffer.from(buffer));
        }
      }
    } catch (err) {
      console.error("Stream Proxy Error for url:", streamUrl, err);
      res.status(500).send("Proxy error: " + err.message);
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
