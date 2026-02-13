import { existsSync } from "node:fs";

const requested_port = Number(process.env.PORT || 4000);
const root = process.cwd();

function guess_type(pathname: string): string {
  if (pathname.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (pathname.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (pathname.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".ico")) {
    return "image/x-icon";
  }
  if (pathname.endsWith(".ts")) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

function make_handler(req: Request): Response {
  const url = new URL(req.url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    pathname = "/index.html";
  }

  let local_path = `${root}/public${pathname}`;
  if (!existsSync(local_path)) {
    local_path = `${root}${pathname}`;
  }

  if (!existsSync(local_path)) {
    return new Response("Not found", { status: 404 });
  }

  const file = Bun.file(local_path);
  return new Response(file, {
    headers: {
      "content-type": guess_type(local_path)
    }
  });
}

let server: Bun.Server | null = null;
let port = requested_port;
const ports = [requested_port, requested_port + 1, requested_port + 2];

for (const candidate of ports) {
  try {
    server = Bun.serve({
      port: candidate,
      fetch(req) {
        return make_handler(req);
      }
    });
    port = candidate;
    break;
  } catch {
    continue;
  }
}

if (!server) {
  throw new Error(
    `Falha ao iniciar servidor. Portas testadas: ${ports.join(", ")}`
  );
}

console.log(`VibiMon Map Editor running at http://localhost:${port}`);
