import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data-store.json");

// Helper to safely load data
function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { initialized: false };
    }
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading data-store.json:", err);
    return { initialized: false };
  }
}

// Helper to safely write data
function writeStore(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data-store.json:", err);
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "15mb" }));

  // SSE client pool
  let clients: { id: string; res: any }[] = [];

  // API: Get current unified data
  app.get("/api/data", (req, res) => {
    const data = readStore();
    res.json(data);
  });

  // API: Seed database on first startup from device's localStorage
  app.post("/api/seed", (req, res) => {
    const seed = req.body;
    const current = readStore();
    if (current.initialized) {
      return res.json({ success: false, message: "Already initialized" });
    }
    
    const payload = {
      initialized: true,
      database: seed.database || {},
      componentTypes: seed.componentTypes || [],
      areas: seed.areas || [],
      licenses: seed.licenses || [],
      inventoryItems: seed.inventoryItems || [],
      auditLogs: seed.auditLogs || [],
      decommissionedItems: seed.decommissionedItems || []
    };
    
    writeStore(payload);
    res.json({ success: true });
  });

  // API: Save incremental custom field updates and broadcast real-time
  app.post("/api/update", (req, res) => {
    const { field, value } = req.body;
    const clientId = req.headers["x-client-id"] as string;

    const data = readStore();
    
    // Ensure initialized has structure
    if (!data.initialized) {
      data.initialized = true;
    }

    data[field] = value;
    writeStore(data);

    // Broadcast update via SSE
    const payload = JSON.stringify({ field, value, senderId: clientId });
    clients.forEach((client) => {
      // Do not broadcast back if it was sent by the original client
      if (client.id !== clientId) {
        client.res.write(`data: ${payload}\n\n`);
      }
    });

    res.json({ success: true });
  });

  // API: SSE connections endpoint
  app.get("/api/events", (req, res) => {
    const clientId = req.query.clientId as string || Math.random().toString(36).substring(2, 9);
    
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    res.write(":\n\n"); // SSE ping/handshake comment

    const clientObj = { id: clientId, res };
    clients.push(clientObj);

    // Dynamic ping interval to hold request alive across firewalls/proxies
    const pingInterval = setInterval(() => {
      res.write(":\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(pingInterval);
      clients = clients.filter((c) => c !== clientObj);
    });
  });

  // Vite development vs production compiler modes
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SIA CLOUD] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
