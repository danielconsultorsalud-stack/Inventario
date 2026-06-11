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
import {
  getServiceAccountToken,
  syncDatabaseToGoogleSheetServer
} from "./src/utils/googleSheetsServer.ts";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data-store.json");
const PG_CONFIG_FILE = path.join(process.cwd(), "postgres-config.json");
const GOOGLE_SHEETS_CONFIG_FILE = path.join(process.cwd(), "google-sheets-config.json");

// Save/Load Google Sheets back-end integration persistently
interface SheetsServerConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  serviceAccountJson: string; // Stored as a raw stringified JSON or plain string
}

function readSheetsConfig(): SheetsServerConfig {
  try {
    if (fs.existsSync(GOOGLE_SHEETS_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GOOGLE_SHEETS_CONFIG_FILE, "utf8"));
      return {
        spreadsheetId: parsed.spreadsheetId || "",
        spreadsheetUrl: parsed.spreadsheetUrl || "",
        serviceAccountJson: parsed.serviceAccountJson || ""
      };
    }
  } catch (err) {
    console.error("[Sheets Setup] Error reading google-sheets-config.json:", err);
  }
  return { spreadsheetId: "", spreadsheetUrl: "", serviceAccountJson: "" };
}

function writeSheetsConfig(config: SheetsServerConfig) {
  try {
    fs.writeFileSync(GOOGLE_SHEETS_CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("[Sheets Setup] Error writing google-sheets-config.json:", err);
  }
}

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

        // Auto-migrate if Postgres counts are empty but we have local backup data
        try {
          const countCheck = await pool.query("SELECT COUNT(*) FROM sia_assets");
          const count = parseInt(countCheck.rows[0].count || "0", 10);
          if (count === 0) {
            const localData = readStore();
            if (localData && Object.keys(localData.database || {}).length > 0) {
              console.log("[Postgres Start] La base de datos de Neon está vacía. Iniciando auto-migración de datos locales...");
              await migrateAllToPostgres(pool, localData);
              console.log("[Postgres Start] ¡Auto-migración inicial completada con éxito!");
            }
          }
        } catch (migErr) {
          console.error("[Postgres Start] Error al intentar auto-migrar datos de inicio:", migErr);
        }
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

      // Auto-migrate if blank
      try {
        const countCheck = await pool.query("SELECT COUNT(*) FROM sia_assets");
        const count = parseInt(countCheck.rows[0].count || "0", 10);
        if (count === 0) {
          const localData = readStore();
          if (localData && Object.keys(localData.database || {}).length > 0) {
            console.log("[Postgres Setup] La nueva base de datos está vacía. Iniciando auto-migración de datos locales...");
            await migrateAllToPostgres(pool, localData);
            console.log("[Postgres Setup] ¡Auto-migración completada con éxito!");
          }
        }
      } catch (migErr) {
        console.error("[Postgres Setup] Error al intentar auto-migrar tras cambiar conexión:", migErr);
      }

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

    // Auto-sync to Google Sheets in background if Service Account is configured
    const sheetsConfig = readSheetsConfig();
    if (sheetsConfig.spreadsheetId && sheetsConfig.serviceAccountJson) {
      (async () => {
        try {
          console.log("[Auto-Sync-Backend] Sincronizando datos automáticamente con Google Sheets...");
          const saObj = JSON.parse(sheetsConfig.serviceAccountJson);
          const token = await getServiceAccountToken(saObj);
          await syncDatabaseToGoogleSheetServer(token, sheetsConfig.spreadsheetId, payload);
          console.log("[Auto-Sync-Backend] ¡Sincronización de Google Sheets completada exitosamente!");
        } catch (sErr) {
          console.error("[Auto-Sync-Backend] Error en sincronización automatizada de Sheets:", sErr);
        }
      })();
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

  // Google Sheets Backend Integration Endpoints
  app.get("/api/google-sheets/status", (req, res) => {
    const config = readSheetsConfig();
    let hasServiceAccount = false;
    let clientEmail = "";
    if (config.serviceAccountJson) {
      try {
        const sa = JSON.parse(config.serviceAccountJson);
        if (sa.client_email && sa.private_key) {
          hasServiceAccount = true;
          clientEmail = sa.client_email;
        }
      } catch (e) {}
    }
    res.json({
      configured: !!config.spreadsheetId,
      hasServiceAccount,
      clientEmail,
      spreadsheetId: config.spreadsheetId,
      spreadsheetUrl: config.spreadsheetUrl
    });
  });

  app.post("/api/google-sheets/config", (req, res) => {
    const { spreadsheetId, spreadsheetUrl, serviceAccountJson } = req.body;
    
    const config = readSheetsConfig();
    if (spreadsheetId !== undefined) config.spreadsheetId = spreadsheetId;
    if (spreadsheetUrl !== undefined) config.spreadsheetUrl = spreadsheetUrl;
    if (serviceAccountJson !== undefined) {
      // If they passed an object, stringify it
      config.serviceAccountJson = typeof serviceAccountJson === "object" 
        ? JSON.stringify(serviceAccountJson, null, 2)
        : serviceAccountJson;
    }
    
    writeSheetsConfig(config);
    res.json({ success: true, message: "Ajustes de Google Sheets guardados correctamente en el servidor." });
  });

  app.post("/api/google-sheets/sync", async (req, res) => {
    const config = readSheetsConfig();
    if (!config.spreadsheetId || !config.serviceAccountJson) {
      return res.status(400).json({ 
        success: false, 
        message: "No se ha configurado la Hoja de Google Sheets o la Cuenta de Servicio en el servidor." 
      });
    }

    try {
      const saObj = JSON.parse(config.serviceAccountJson);
      
      // Load latest unified data (Postgres or local fallback)
      let payload = req.body && Object.keys(req.body).length > 0 ? req.body : null;
      if (!payload) {
        if (isPostgresConnected) {
          const pool = getPostgresPool();
          if (pool) {
            payload = await loadAllFromPostgres(pool);
            // merge sheet configurations
            const localStore = readStore();
            if (localStore.googleSpreadsheetId) payload.googleSpreadsheetId = localStore.googleSpreadsheetId;
            if (localStore.googleSpreadsheetUrl) payload.googleSpreadsheetUrl = localStore.googleSpreadsheetUrl;
          }
        }
        if (!payload) {
          payload = readStore();
        }
      }

      console.log("[Google Sheets Server Manual Sync] Solicitando token...");
      const token = await getServiceAccountToken(saObj);
      console.log("[Google Sheets Server Manual Sync] Actualizando libro:", config.spreadsheetId);
      await syncDatabaseToGoogleSheetServer(token, config.spreadsheetId, payload);
      
      res.json({ success: true, message: "¡Sincronización exitosa! La información ha sido volcada en el Google Sheet." });
    } catch (err: any) {
      console.error("[Google Sheets Server Manual Sync] Falló:", err);
      res.status(500).json({ success: false, message: err?.message || String(err) });
    }
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
