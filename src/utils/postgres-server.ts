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
        alm4 TEXT,
        otros TEXT,
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
      ALTER TABLE sia_assets ADD COLUMN IF NOT EXISTS alm4 TEXT;
      ALTER TABLE sia_assets ADD COLUMN IF NOT EXISTS otros TEXT;
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
      if (!Array.isArray(value) || value.length === 0) {
        await client.query("DELETE FROM sia_areas");
      } else {
        const insertedAreas = new Set<string>();
        const filtered = value.filter(area => area && area.name && !insertedAreas.has(area.name));
        
        if (filtered.length > 0) {
          const names = filtered.map(area => area.name);
          const placeholders = names.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_areas WHERE name NOT IN (${placeholders})`, names);
          
          // Chunk inserts
          const chunkSize = 100;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const area = chunk[i];
              insertedAreas.add(area.name);
              const offset = i * 2;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2})`);
              flatValues.push(area.name, area.color || "#cccccc");
            }
            await client.query(`
              INSERT INTO sia_areas (name, color) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_areas");
        }
      }
    } else if (field === "licenses") {
      if (!Array.isArray(value) || value.length === 0) {
        await client.query("DELETE FROM sia_licenses");
      } else {
        const insertedLicenses = new Set<string>();
        const filtered = value.filter(lic => lic && lic.id && !insertedLicenses.has(lic.id));
        
        if (filtered.length > 0) {
          const ids = filtered.map(lic => lic.id);
          const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_licenses WHERE id NOT IN (${placeholders})`, ids);
          
          // Chunk inserts
          const chunkSize = 100;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const lic = chunk[i];
              insertedLicenses.add(lic.id);
              const offset = i * 3;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
              flatValues.push(lic.id, lic.name || "", lic.limit || 0);
            }
            await client.query(`
              INSERT INTO sia_licenses (id, name, limit_count) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, 
                limit_count = EXCLUDED.limit_count
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_licenses");
        }
      }
    } else if (field === "componentTypes") {
      if (!Array.isArray(value) || value.length === 0) {
        await client.query("DELETE FROM sia_component_types");
      } else {
        const insertedComponents = new Set<string>();
        const filtered = value.filter(ct => ct && ct.id && !insertedComponents.has(ct.id));
        
        if (filtered.length > 0) {
          const ids = filtered.map(ct => ct.id);
          const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_component_types WHERE id NOT IN (${placeholders})`, ids);
          
          // Chunk inserts
          const chunkSize = 100;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const ct = chunk[i];
              insertedComponents.add(ct.id);
              const offset = i * 3;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
              flatValues.push(ct.id, ct.name || "", ct.icon || "");
            }
            await client.query(`
              INSERT INTO sia_component_types (id, name, icon) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, 
                icon = EXCLUDED.icon
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_component_types");
        }
      }
    } else if (field === "inventoryItems") {
      if (!Array.isArray(value) || value.length === 0) {
        await client.query("DELETE FROM sia_inventory_items");
      } else {
        const insertedItems = new Set<string>();
        const filtered = value.filter(item => item && item.id && !insertedItems.has(item.id));
        
        if (filtered.length > 0) {
          const ids = filtered.map(item => item.id);
          const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_inventory_items WHERE id NOT IN (${placeholders})`, ids);
          
          // Chunk inserts
          const chunkSize = 50;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const item = chunk[i];
              insertedItems.add(item.id);
              const offset = i * 6;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
              flatValues.push(item.id, item.name || "", item.type || "", item.quantity || 0, item.serial || null, item.notes || null);
            }
            await client.query(`
              INSERT INTO sia_inventory_items (id, name, type, quantity, serial, notes) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, 
                type = EXCLUDED.type, 
                quantity = EXCLUDED.quantity, 
                serial = EXCLUDED.serial, 
                notes = EXCLUDED.notes
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_inventory_items");
        }
      }
    } else if (field === "decommissionedItems") {
      if (!Array.isArray(value) || value.length === 0) {
        await client.query("DELETE FROM sia_decommissioned_items");
      } else {
        const insertedDecoms = new Set<string>();
        const filtered = value.filter(dec => dec && dec.id && !insertedDecoms.has(dec.id));
        
        if (filtered.length > 0) {
          const ids = filtered.map(dec => dec.id);
          const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_decommissioned_items WHERE id NOT IN (${placeholders})`, ids);
          
          // Chunk inserts
          const chunkSize = 50;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const dec = chunk[i];
              insertedDecoms.add(dec.id);
              const offset = i * 8;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
              flatValues.push(
                dec.id,
                dec.name || "",
                dec.type || "",
                dec.serial || null,
                dec.quantity || 0,
                dec.reason || "",
                dec.timestamp || new Date().toISOString(),
                dec.originalWorkstation || null
              );
            }
            await client.query(`
              INSERT INTO sia_decommissioned_items (id, name, type, serial, quantity, reason, timestamp, original_workstation) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, 
                type = EXCLUDED.type, 
                serial = EXCLUDED.serial, 
                quantity = EXCLUDED.quantity, 
                reason = EXCLUDED.reason, 
                timestamp = EXCLUDED.timestamp, 
                original_workstation = EXCLUDED.original_workstation
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_decommissioned_items");
        }
      }
    } else if (field === "auditLogs") {
      const logsSlice = Array.isArray(value) ? value.slice(0, 500) : [];
      if (logsSlice.length === 0) {
        await client.query("DELETE FROM sia_audit_logs");
      } else {
        const insertedLogs = new Set<string>();
        const filtered = logsSlice.filter(log => log && log.id && !insertedLogs.has(log.id));
        
        if (filtered.length > 0) {
          const ids = filtered.map(log => log.id);
          const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_audit_logs WHERE id NOT IN (${placeholders})`, ids);
          
          // Chunk inserts
          const chunkSize = 100;
          for (let chunkIdx = 0; chunkIdx < filtered.length; chunkIdx += chunkSize) {
            const chunk = filtered.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            for (let i = 0; i < chunk.length; i++) {
              const log = chunk[i];
              insertedLogs.add(log.id);
              const offset = i * 5;
              valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
              flatValues.push(log.id, log.timestamp || "", log.action || "", log.description || "", log.user || "");
            }
            await client.query(`
              INSERT INTO sia_audit_logs (id, timestamp, action, description, log_user) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (id) DO NOTHING
            `, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_audit_logs");
        }
      }
    } else if (field === "database") {
      if (!value || typeof value !== "object" || Object.keys(value).length === 0) {
        await client.query("DELETE FROM sia_assets");
      } else {
        const insertedAssets = new Set<string>();
        const entries = Object.entries(value).filter(([puestoId, asset]) => asset && typeof asset === "object" && !insertedAssets.has(puestoId));
        
        if (entries.length > 0) {
          const ids = entries.map(([puestoId]) => puestoId);
          const deletePlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
          await client.query(`DELETE FROM sia_assets WHERE puesto_id NOT IN (${deletePlaceholders})`, ids);
          
          const columns = [
            "puesto_id", "nombre_equipo", "asignado_a", "area_select", "board", "video", "procesador",
            "ram1", "ram2", "ram3", "ram4", "alm1", "alm2", "alm3", "alm4", "mon1", "mon2", "wifi", "mouse", "teclado",
            "camara", "auriculares", "otros", "licencia_ids", "comentarios"
          ];
          
          // Chunk inserts in batches of 50 to avoid parameter limits and speed up execution
          const chunkSize = 50;
          for (let chunkIdx = 0; chunkIdx < entries.length; chunkIdx += chunkSize) {
            const chunk = entries.slice(chunkIdx, chunkIdx + chunkSize);
            const valuePlaceholders: string[] = [];
            const flatValues: any[] = [];
            
            for (let i = 0; i < chunk.length; i++) {
              const [puestoId, asset] = chunk[i];
              insertedAssets.add(puestoId);
              const castAsset = asset as any;
              const licIds = Array.isArray(castAsset.licencia_ids)
                ? castAsset.licencia_ids.join(",")
                : castAsset.licencia_id || "";
                
              const rowValues = [
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
                castAsset.alm4 || null,
                castAsset.mon1 || null,
                castAsset.mon2 || null,
                castAsset.wifi || null,
                castAsset.mouse || null,
                castAsset.teclado || null,
                castAsset.camara || null,
                castAsset.auriculares || null,
                castAsset.otros || null,
                licIds || null,
                castAsset.comentarios || null,
              ];
              
              const offset = i * columns.length;
              const placeholders = rowValues.map((_, colIdx) => `$${offset + colIdx + 1}`).join(", ");
              valuePlaceholders.push(`(${placeholders})`);
              flatValues.push(...rowValues);
            }
            
            const queryText = `
              INSERT INTO sia_assets (${columns.join(", ")}) 
              VALUES ${valuePlaceholders.join(", ")} 
              ON CONFLICT (puesto_id) DO UPDATE SET
                nombre_equipo = EXCLUDED.nombre_equipo,
                asignado_a = EXCLUDED.asignado_a,
                area_select = EXCLUDED.area_select,
                board = EXCLUDED.board,
                video = EXCLUDED.video,
                procesador = EXCLUDED.procesador,
                ram1 = EXCLUDED.ram1,
                ram2 = EXCLUDED.ram2,
                ram3 = EXCLUDED.ram3,
                ram4 = EXCLUDED.ram4,
                alm1 = EXCLUDED.alm1,
                alm2 = EXCLUDED.alm2,
                alm3 = EXCLUDED.alm3,
                alm4 = EXCLUDED.alm4,
                mon1 = EXCLUDED.mon1,
                mon2 = EXCLUDED.mon2,
                wifi = EXCLUDED.wifi,
                mouse = EXCLUDED.mouse,
                teclado = EXCLUDED.teclado,
                camara = EXCLUDED.camara,
                auriculares = EXCLUDED.auriculares,
                otros = EXCLUDED.otros,
                licencia_ids = EXCLUDED.licencia_ids,
                comentarios = EXCLUDED.comentarios
            `;
            await client.query(queryText, flatValues);
          }
        } else {
          await client.query("DELETE FROM sia_assets");
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
        alm4: r.alm4 || undefined,
        mon1: r.mon1 || undefined,
        mon2: r.mon2 || undefined,
        wifi: r.wifi || undefined,
        mouse: r.mouse || undefined,
        teclado: r.teclado || undefined,
        camara: r.camara || undefined,
        auriculares: r.auriculares || undefined,
        otros: r.otros || undefined,
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
