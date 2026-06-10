import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  getPostgresPool,
  createTables,
  saveFieldToPostgres,
  migrateAllToPostgres,
  loadAllFromPostgres
} from "./src/utils/postgres-server.ts";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data-store.json");
const PG_CONFIG_FILE = path.join(process.cwd(), "postgres-config.json");

// Save/Load Postgres credentials persistently
function readPostgresConfig(): string {
  try {
    if (fs.existsSync(PG_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PG_CONFIG_FILE, "utf8"));
      return parsed.connectionString || "";
    }
  } catch (err) {
    console.error("[Postgres] Error reading postgres-config.json:", err);
  }
  return "";
}

function writePostgresConfig(connectionString: string) {
  try {
    fs.writeFileSync(PG_CONFIG_FILE, JSON.stringify({ connectionString }, null, 2), "utf8");
  } catch (err) {
    console.error("[Postgres] Error writing postgres-config.json:", err);
  }
}

// Helper to safely load local JSON store
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

// Helper to safely write local JSON store
function writeStore(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data-store.json:", err);
  }
}

async function startServer() {
  const app = express();

  // Custom CORS middleware to allow Vercel and Netlify frontends to interface with Cloud Run Express backend
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-client-id");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "15mb" }));

  // SSE client pool
  let clients: { id: string; res: any }[] = [];

  // Initialize pool if connection string exists
  let pgConnectionString = readPostgresConfig() || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
  let isPostgresConnected = false;
  let postgresErrorMsg = "";

  if (pgConnectionString) {
    try {
      console.log("[Postgres] Intentando conectar a Neon Postgres...");
      const pool = getPostgresPool(pgConnectionString);
      if (pool) {
        await createTables(pool);
        isPostgresConnected = true;
        console.log("[Postgres] ¡Conexión establecida con éxito!");
      }
    } catch (err: any) {
      console.error("[Postgres] Error en la conexión inicial:", err);
      postgresErrorMsg = err?.message || String(err);
    }
  }

  // API Check connection status
  app.get("/api/postgres/status", (req, res) => {
    res.json({
      connected: isPostgresConnected,
      hasConfig: !!pgConnectionString,
      error: postgresErrorMsg,
      connectionUrlMasked: pgConnectionString
        ? pgConnectionString.replace(/:([^:@]+)@/, ":******@") // Mask password
        : ""
    });
  });

  // API Config/Test and Save Connection String
  app.post("/api/postgres/setup", async (req, res) => {
    const { connectionString } = req.body;
    if (!connectionString) {
      return res.status(400).json({ success: false, message: "La URL de conexión es requerida" });
    }

    try {
      console.log("[Postgres] Probando nueva conexión Postgres...");
      const pool = getPostgresPool(connectionString);
      if (!pool) {
        throw new Error("No se pudo instanciar el pool de conexión.");
      }
      
      // Test the pool
      const testClient = await pool.connect();
      testClient.release();
      
      // Run table creation schema
      await createTables(pool);

      // Save configuration permanently on server
      pgConnectionString = connectionString;
      writePostgresConfig(connectionString);
      isPostgresConnected = true;
      postgresErrorMsg = "";

      console.log("[Postgres] Nueva base de datos guardada y conectada.");
      res.json({ success: true, message: "Conexión a Postgres establecida y verificada correctamente." });
    } catch (err: any) {
      console.error("[Postgres] Test de conexión fallido:", err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  // API Disconnect database
  app.post("/api/postgres/disconnect", (req, res) => {
    try {
      writePostgresConfig("");
      pgConnectionString = "";
      isPostgresConnected = false;
      postgresErrorMsg = "";
      
      const pool = getPostgresPool(""); // will clean/close current pool
      res.json({ success: true, message: "Desconectado de PostgreSQL. Volviendo a base de datos de archivo." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  // API Run manual migration from JSON to Postgres
  app.post("/api/postgres/migrate", async (req, res) => {
    if (!isPostgresConnected) {
      return res.status(400).json({ success: false, message: "No estás conectado a una base de datos Postgres activa." });
    }

    try {
      const pool = getPostgresPool();
      if (!pool) throw new Error("Base de datos no instanciada.");
      
      const localData = readStore();
      await migrateAllToPostgres(pool, localData);

      res.json({ success: true, message: "Migración masiva de datos a Neon Postgres finalizada con éxito." });
    } catch (err: any) {
      console.error("[Postgres] Error en migración:", err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  // API: Get current unified data
  app.get("/api/data", async (req, res) => {
    if (isPostgresConnected) {
      try {
        const pool = getPostgresPool();
        if (pool) {
          const pgData = await loadAllFromPostgres(pool) as any;
          
          // Merge configuration/Sheets details from local config to avoid losing them
          const localStore = readStore();
          if (localStore.googleSpreadsheetId) pgData.googleSpreadsheetId = localStore.googleSpreadsheetId;
          if (localStore.googleSpreadsheetUrl) pgData.googleSpreadsheetUrl = localStore.googleSpreadsheetUrl;
          
          return res.json(pgData);
        }
      } catch (err) {
        console.error("[Postgres] Error cargando desde Postgres, recurriendo a archivo local:", err);
      }
    }
    
    // Fallback to local files
    const data = readStore();
    res.json(data);
  });

  // API: Seed database on first startup
  app.post("/api/seed", async (req, res) => {
    const seed = req.body;
    
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
    
    // Always write to local backup store
    writeStore(payload);

    // If Postgres is connected, sync seeded data immediately
    if (isPostgresConnected) {
      try {
        const pool = getPostgresPool();
        if (pool) {
          await migrateAllToPostgres(pool, payload);
        }
      } catch (err) {
        console.error("[Postgres] Error persistiendo la semilla de datos en Postgres:", err);
      }
    }

    res.json({ success: true });
  });

  // API: Save incremental custom field updates and broadcast real-time
  app.post("/api/update", async (req, res) => {
    const { field, value } = req.body;
    const clientId = req.headers["x-client-id"] as string;

    // Dual-write: Write to local JSON backup first
    const data = readStore();
    if (!data.initialized) {
      data.initialized = true;
    }
    data[field] = value;
    writeStore(data);

    // Write to Postgres if connected
    if (isPostgresConnected) {
      try {
        const pool = getPostgresPool();
        if (pool) {
          await saveFieldToPostgres(pool, field, value);
        }
      } catch (err) {
        console.error(`[Postgres] Error al actualizar campo [${field}] en base de datos Postgres:`, err);
        // Do not fail the whole request because local file write succeeded (resilience!)
      }
    }

    // Broadcast update via SSE
    const payload = JSON.stringify({ field, value, senderId: clientId });
    clients.forEach((client) => {
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

    res.write(":\n\n"); // SSE handshake

    const clientObj = { id: clientId, res };
    clients.push(clientObj);

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
