import pg from "pg";
const { Pool } = pg;

let pool: pg.Pool | null = null;
let currentConnectionString: string | null = null;

export function getPostgresPool(connectionString?: string): pg.Pool | null {
  const connStr = connectionString || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) return null;

  if (pool && currentConnectionString === connStr) {
    return pool;
  }

  if (pool) {
    pool.end().catch((err) => console.error("[Postgres] Error al cerrar pool anterior:", err));
  }

  console.log("[Postgres] Inicializando nuevo pool de conexión...");
  currentConnectionString = connStr;
  pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes("neon.tech") || connStr.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

export async function createTables(poolInstance: pg.Pool) {
  const client = await poolInstance.connect();
  try {
    await client.query("BEGIN");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_areas (
        name VARCHAR(255) PRIMARY KEY,
        color VARCHAR(50) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_licenses (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        limit_count INT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_component_types (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(100) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_inventory_items (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        serial TEXT,
        notes TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_decommissioned_items (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        serial TEXT,
        quantity INT NOT NULL,
        reason TEXT NOT NULL,
        timestamp VARCHAR(100) NOT NULL,
        original_workstation TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_assets (
        puesto_id VARCHAR(255) PRIMARY KEY,
        nombre_equipo TEXT,
        asignado_a TEXT,
        area_select TEXT,
        board TEXT,
        video TEXT,
        procesador TEXT,
        ram1 TEXT,
        ram2 TEXT,
        ram3 TEXT,
        ram4 TEXT,
        alm1 TEXT,
        alm2 TEXT,
        alm3 TEXT,
        mon1 TEXT,
        mon2 TEXT,
        wifi TEXT,
        mouse TEXT,
        teclado TEXT,
        camara TEXT,
        auriculares TEXT,
        licencia_ids TEXT,
        comentarios TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sia_audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp VARCHAR(100) NOT NULL,
        action VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        log_user VARCHAR(255) NOT NULL
      );
    `);

    await client.query("COMMIT");
    console.log("[Postgres] Tablas de inventario SIA verificadas o creadas con éxito.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Postgres] Error al crear tablas relacionales:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function saveFieldToPostgres(poolInstance: pg.Pool, field: string, value: any) {
  const client = await poolInstance.connect();
  try {
    await client.query("BEGIN");
    if (field === "areas") {
      await client.query("DELETE FROM sia_areas");
      if (Array.isArray(value)) {
        const insertedAreas = new Set<string>();
        for (const area of value) {
          if (area && area.name && !insertedAreas.has(area.name)) {
            insertedAreas.add(area.name);
            await client.query(
              "INSERT INTO sia_areas (name, color) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
              [area.name, area.color || "#cccccc"]
            );
          }
        }
      }
    } else if (field === "licenses") {
      await client.query("DELETE FROM sia_licenses");
      if (Array.isArray(value)) {
        const insertedLicenses = new Set<string>();
        for (const lic of value) {
          if (lic && lic.id && !insertedLicenses.has(lic.id)) {
            insertedLicenses.add(lic.id);
            await client.query(
              "INSERT INTO sia_licenses (id, name, limit_count) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
              [lic.id, lic.name || "", lic.limit || 0]
            );
          }
        }
      }
    } else if (field === "componentTypes") {
      await client.query("DELETE FROM sia_component_types");
      if (Array.isArray(value)) {
        const insertedComponents = new Set<string>();
        for (const ct of value) {
          if (ct && ct.id && !insertedComponents.has(ct.id)) {
            insertedComponents.add(ct.id);
            await client.query(
              "INSERT INTO sia_component_types (id, name, icon) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
              [ct.id, ct.name || "", ct.icon || ""]
            );
          }
        }
      }
    } else if (field === "inventoryItems") {
      await client.query("DELETE FROM sia_inventory_items");
      if (Array.isArray(value)) {
        const insertedItems = new Set<string>();
        for (const item of value) {
          if (item && item.id && !insertedItems.has(item.id)) {
            insertedItems.add(item.id);
            await client.query(
              "INSERT INTO sia_inventory_items (id, name, type, quantity, serial, notes) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
              [item.id, item.name || "", item.type || "", item.quantity || 0, item.serial || null, item.notes || null]
            );
          }
        }
      }
    } else if (field === "decommissionedItems") {
      await client.query("DELETE FROM sia_decommissioned_items");
      if (Array.isArray(value)) {
        const insertedDecoms = new Set<string>();
        for (const dec of value) {
          if (dec && dec.id && !insertedDecoms.has(dec.id)) {
            insertedDecoms.add(dec.id);
            await client.query(
              "INSERT INTO sia_decommissioned_items (id, name, type, serial, quantity, reason, timestamp, original_workstation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING",
              [
                dec.id,
                dec.name || "",
                dec.type || "",
                dec.serial || null,
                dec.quantity || 0,
                dec.reason || "",
                dec.timestamp || new Date().toISOString(),
                dec.originalWorkstation || null,
              ]
            );
          }
        }
      }
    } else if (field === "auditLogs") {
      await client.query("DELETE FROM sia_audit_logs");
      if (Array.isArray(value)) {
        const insertedLogs = new Set<string>();
        for (const log of value.slice(0, 500)) { // limit to 500 logs for safe performance
          if (log && log.id && !insertedLogs.has(log.id)) {
            insertedLogs.add(log.id);
            await client.query(
              "INSERT INTO sia_audit_logs (id, timestamp, action, description, log_user) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
              [log.id, log.timestamp || "", log.action || "", log.description || "", log.user || ""]
            );
          }
        }
      }
    } else if (field === "database") {
      await client.query("DELETE FROM sia_assets");
      if (value && typeof value === "object") {
        const insertedAssets = new Set<string>();
        for (const [puestoId, asset] of Object.entries(value)) {
          if (asset && typeof asset === "object" && !insertedAssets.has(puestoId)) {
            insertedAssets.add(puestoId);
            const castAsset = asset as any;
            const licIds = Array.isArray(castAsset.licencia_ids)
              ? castAsset.licencia_ids.join(",")
              : castAsset.licencia_id || "";
            await client.query(
              `INSERT INTO sia_assets (
                puesto_id, nombre_equipo, asignado_a, area_select, board, video, procesador,
                ram1, ram2, ram3, ram4, alm1, alm2, alm3, mon1, mon2, wifi, mouse, teclado,
                camara, auriculares, licencia_ids, comentarios
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) ON CONFLICT (puesto_id) DO NOTHING`,
              [
                puestoId,
                castAsset.nombre_equipo || null,
                castAsset.asignado_a || null,
                castAsset.area_select || null,
                castAsset.board || null,
                castAsset.video || null,
                castAsset.procesador || null,
                castAsset.ram1 || null,
                castAsset.ram2 || null,
                castAsset.ram3 || null,
                castAsset.ram4 || null,
                castAsset.alm1 || null,
                castAsset.alm2 || null,
                castAsset.alm3 || null,
                castAsset.mon1 || null,
                castAsset.mon2 || null,
                castAsset.wifi || null,
                castAsset.mouse || null,
                castAsset.teclado || null,
                castAsset.camara || null,
                castAsset.auriculares || null,
                licIds || null,
                castAsset.comentarios || null,
              ]
            );
          }
        }
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[Postgres] Error guardando campo [${field}]:`, err);
    throw err;
  } finally {
    client.release();
  }
}

export async function migrateAllToPostgres(poolInstance: pg.Pool, localData: any) {
  console.log("[Postgres] Iniciando migración masiva a base de datos de Neon Postgres...");
  if (!localData || typeof localData !== "object") return;
  
  const fields = [
    "areas",
    "licenses",
    "componentTypes",
    "inventoryItems",
    "decommissionedItems",
    "auditLogs",
    "database"
  ];
  
  for (const field of fields) {
    if (localData[field] !== undefined) {
      await saveFieldToPostgres(poolInstance, field, localData[field]);
    }
  }
  console.log("[Postgres] ¡Migración masiva completada exitosamente!");
}

export async function loadAllFromPostgres(poolInstance: pg.Pool) {
  const client = await poolInstance.connect();
  try {
    const areasRes = await client.query("SELECT * FROM sia_areas");
    const licsRes = await client.query("SELECT * FROM sia_licenses");
    const compsRes = await client.query("SELECT * FROM sia_component_types");
    const invRes = await client.query("SELECT * FROM sia_inventory_items");
    const decRes = await client.query("SELECT * FROM sia_decommissioned_items");
    const assetsRes = await client.query("SELECT * FROM sia_assets");
    const logsRes = await client.query("SELECT * FROM sia_audit_logs ORDER BY timestamp DESC LIMIT 500");

    // Convert areas
    const areas = areasRes.rows.map((r) => ({ name: r.name, color: r.color }));

    // Convert licenses
    const licenses = licsRes.rows.map((r) => ({ id: r.id, name: r.name, limit: r.limit_count }));

    // Convert component types
    const componentTypes = compsRes.rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon }));

    // Convert inventory
    const inventoryItems = invRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      quantity: r.quantity,
      serial: r.serial || undefined,
      notes: r.notes || undefined,
    }));

    // Convert decommissioned items
    const decommissionedItems = decRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      serial: r.serial || undefined,
      quantity: r.quantity,
      reason: r.reason,
      timestamp: r.timestamp,
      originalWorkstation: r.original_workstation || undefined,
    }));

    // Convert audit logs
    const auditLogs = logsRes.rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      action: r.action,
      description: r.description,
      user: r.log_user,
    }));

    // Convert assets database
    const database: Record<string, any> = {};
    assetsRes.rows.forEach((r) => {
      const licIdsText = r.licencia_ids || "";
      const licencia_ids = licIdsText ? licIdsText.split(",") : [];
      database[r.puesto_id] = {
        nombre_equipo: r.nombre_equipo || undefined,
        asignado_a: r.asignado_a || undefined,
        area_select: r.area_select || undefined,
        board: r.board || undefined,
        video: r.video || undefined,
        procesador: r.procesador || undefined,
        ram1: r.ram1 || undefined,
        ram2: r.ram2 || undefined,
        ram3: r.ram3 || undefined,
        ram4: r.ram4 || undefined,
        alm1: r.alm1 || undefined,
        alm2: r.alm2 || undefined,
        alm3: r.alm3 || undefined,
        mon1: r.mon1 || undefined,
        mon2: r.mon2 || undefined,
        wifi: r.wifi || undefined,
        mouse: r.mouse || undefined,
        teclado: r.teclado || undefined,
        camara: r.camara || undefined,
        auriculares: r.auriculares || undefined,
        licencia_id: licencia_ids[0] || undefined,
        licencia_ids: licencia_ids,
        comentarios: r.comentarios || undefined,
      };
    });

    return {
      initialized: true,
      database,
      componentTypes,
      areas,
      licenses,
      inventoryItems,
      auditLogs,
      decommissionedItems,
    };
  } catch (err) {
    console.error("[Postgres] Error cargando datos de tablas relacionales:", err);
    throw err;
  } finally {
    client.release();
  }
}
