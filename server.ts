import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const fsRoot = "."; // Serve from the current directory

  // Helper to check if a file exists locally
  const exists = async (path: string) => {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  };

  // Construct the local path (e.g., "./Build/game.wasm")
  const localPath = `${fsRoot}${decodeURIComponent(url.pathname)}`;

  // --- Case 1: Explicit request for a compressed file (.br or .gz) ---
  // The browser/loader is asking for "file.js.br" directly.
  // We must serve it with "Content-Encoding: br" and the correct content type for the underlying file.
  if (localPath.endsWith(".br") && (await exists(localPath))) {
    const res = await serveDir(req, { fsRoot });
    res.headers.set("Content-Encoding", "br");

    // Guess Content-Type from the part before .br
    // e.g. "file.wasm.br" -> "file.wasm"
    const originalPath = url.pathname.slice(0, -3);
    if (originalPath.endsWith(".wasm"))
      res.headers.set("Content-Type", "application/wasm");
    else if (originalPath.endsWith(".js"))
      res.headers.set("Content-Type", "application/javascript");
    else if (originalPath.endsWith(".data"))
      res.headers.set("Content-Type", "application/octet-stream");

    return res;
  }

  if (localPath.endsWith(".gz") && (await exists(localPath))) {
    const res = await serveDir(req, { fsRoot });
    res.headers.set("Content-Encoding", "gzip");

    const originalPath = url.pathname.slice(0, -3);
    if (originalPath.endsWith(".wasm"))
      res.headers.set("Content-Type", "application/wasm");
    else if (originalPath.endsWith(".js"))
      res.headers.set("Content-Type", "application/javascript");
    else if (originalPath.endsWith(".data"))
      res.headers.set("Content-Type", "application/octet-stream");

    return res;
  }

  // --- Case 2: Implicit request (e.g. requesting .unityweb but we have .br) ---

  // Determine the path to check for compressed versions
  let pathToCheck = localPath;
  if (localPath.endsWith(".unityweb")) {
    const stripped = localPath.slice(0, -".unityweb".length);
    // Check if the stripped version exists as .br or .gz
    if ((await exists(stripped + ".br")) || (await exists(stripped + ".gz"))) {
      pathToCheck = stripped;
    }
  }

  // Check for Brotli (.br)
  if (await exists(pathToCheck + ".br")) {
    const newPathname = pathToCheck.startsWith("./")
      ? pathToCheck.slice(1)
      : pathToCheck;
    const brReq = new Request(
      new URL(newPathname + ".br", url.origin).toString(),
      req
    );
    const res = await serveDir(brReq, { fsRoot });

    res.headers.set("Content-Encoding", "br");

    if (url.pathname.includes(".wasm"))
      res.headers.set("Content-Type", "application/wasm");
    else if (url.pathname.includes(".js"))
      res.headers.set("Content-Type", "application/javascript");
    else if (url.pathname.includes(".data"))
      res.headers.set("Content-Type", "application/octet-stream");

    return res;
  }

  // Check for Gzip (.gz)
  if (await exists(pathToCheck + ".gz")) {
    const newPathname = pathToCheck.startsWith("./")
      ? pathToCheck.slice(1)
      : pathToCheck;
    const gzReq = new Request(
      new URL(newPathname + ".gz", url.origin).toString(),
      req
    );
    const res = await serveDir(gzReq, { fsRoot });

    res.headers.set("Content-Encoding", "gzip");

    if (url.pathname.includes(".wasm"))
      res.headers.set("Content-Type", "application/wasm");
    else if (url.pathname.includes(".js"))
      res.headers.set("Content-Type", "application/javascript");
    else if (url.pathname.includes(".data"))
      res.headers.set("Content-Type", "application/octet-stream");

    return res;
  }

  // 3. Serve normal file (or 404)
  return serveDir(req, {
    fsRoot,
    showDirListing: true,
  });
});
