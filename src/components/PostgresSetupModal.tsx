import React, { useState, useEffect } from "react";
import { X, Database, RefreshCw, CheckCircle, AlertTriangle, Play, Power } from "lucide-react";
import {
  getConnectionString,
  saveConnectionString,
  clearConnectionString,
  clientCreateTables,
  clientMigrateAllToPostgres
} from "../utils/postgres-client";

const isStaticHosting = typeof window !== "undefined" && (
  window.location.hostname.includes("vercel") ||
  window.location.hostname.includes("netlify") ||
  window.location.hostname.includes("github.io") ||
  (window.location.hostname.includes("localhost") === false &&
   window.location.hostname.includes("127.0.0.1") === false &&
   window.location.hostname.includes("run.app") === false)
);

interface PostgresSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDbStatusChange?: (isConnected: boolean) => void;
}

export const PostgresSetupModal: React.FC<PostgresSetupModalProps> = ({
  isOpen,
  onClose,
  onDbStatusChange,
}) => {
  const [status, setStatus] = useState<{
    connected: boolean;
    hasConfig: boolean;
    error: string;
    connectionUrlMasked: string;
  } | null>(null);

  const [connectionString, setConnectionString] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchStatus = async () => {
    if (isStaticHosting) {
      const conn = getConnectionString();
      const statusData = {
        connected: !!conn,
        hasConfig: !!conn,
        error: "",
        connectionUrlMasked: conn ? conn.replace(/:([^:@]+)@/, ":******@") : ""
      };
      setStatus(statusData);
      if (onDbStatusChange) onDbStatusChange(!!conn);
      return;
    }

    try {
      const res = await fetch("/api/postgres/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (onDbStatusChange) onDbStatusChange(data.connected);
      }
    } catch (err) {
      console.error("Error fetching postgres status:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionString.trim()) {
      setFeedback({ type: "error", msg: "La URL de conexión es requerida" });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (isStaticHosting) {
        const { Client } = await import("@neondatabase/serverless");
        const testClient = new Client(connectionString.trim());
        await testClient.connect();
        await testClient.query("SELECT 1");
        await testClient.end();
        
        // Save first so clientCreateTables can fetch it
        saveConnectionString(connectionString.trim());
        
        // Create tables
        await clientCreateTables();

        setFeedback({ type: "success", msg: "¡Éxito! Conexión a Neon Postgres establecida y tablas creadas (Directo)." });
        setConnectionString("");
        await fetchStatus();
        return;
      }

      const res = await fetch("/api/postgres/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: connectionString.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", msg: "¡Éxito! Conexión a Neon Postgres establecida y tablas creadas." });
        setConnectionString("");
        await fetchStatus();
      } else {
        setFeedback({ type: "error", msg: data.message || "No se pudo conectar a la base de datos." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "Error al conectar." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("¿Estás seguro de que deseas desconectar Neon Postgres? El sistema volverá a la base de datos local de archivo.")) {
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      if (isStaticHosting) {
        clearConnectionString();
        setFeedback({ type: "success", msg: "Se ha desconectado de Postgres con éxito (Directo)." });
        await fetchStatus();
        return;
      }

      const res = await fetch("/api/postgres/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", msg: "Se ha desconectado de Postgres con éxito." });
        await fetchStatus();
      } else {
        setFeedback({ type: "error", msg: data.message || "Error al desconectar." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "Error al desconectar." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm("¿Deseas migrar toda la base de datos actual (dispositivos, licencias, áreas, bodega y logs) a Neon Postgres? Esto reemplazará las tablas correspondientes en Postgres con tus datos de archivo local.")) {
      return;
    }

    setIsMigrating(true);
    setFeedback(null);

    try {
      if (isStaticHosting) {
        if (!getConnectionString()) throw new Error("Base de datos no instanciada.");

        const localData = {
          database: JSON.parse(localStorage.getItem("sia_master_v5") || "{}"),
          componentTypes: JSON.parse(localStorage.getItem("sia_component_types_v5") || "[]"),
          areas: JSON.parse(localStorage.getItem("sia_areas_v5") || "[]"),
          licenses: JSON.parse(localStorage.getItem("sia_licenses_v5") || "[]"),
          inventoryItems: JSON.parse(localStorage.getItem("sia_inventory_v5") || "[]"),
          auditLogs: JSON.parse(localStorage.getItem("sia_audit_logs_v5") || "[]"),
          decommissionedItems: JSON.parse(localStorage.getItem("sia_decommissioned_v5") || "[]")
        };
        
        await clientMigrateAllToPostgres(localData);
        setFeedback({ type: "success", msg: "¡Migración finalizada con éxito! Todos los registros locales ya están en Neon Postgres (Directo)." });
        return;
      }

      const res = await fetch("/api/postgres/migrate", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", msg: "¡Migración finalizada con éxito! Todos los datos de Firebase/Local ya están en Neon Postgres en formato relacional." });
      } else {
        setFeedback({ type: "error", msg: data.message || "Surgió un error al migrar." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err?.message || "Error durante la migración." });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Base de Datos Neon Postgres
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Migración y Conectividad Relacional
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-150 flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6">
          
          {/* Status section */}
          {status && (
            <div className={`p-4 rounded-2xl border ${status.connected ? "bg-emerald-50/60 border-emerald-150" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${status.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    <Database size={16} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest font-mono text-slate-400">
                      Estado de Conexión
                    </h4>
                    <p className={`text-sm font-black ${status.connected ? "text-emerald-800" : "text-slate-800"}`}>
                      {status.connected ? "🟢 Conectado" : "⚪ Desconectado / Modo Archivo local"}
                    </p>
                  </div>
                </div>
                
                {status.connected && (
                  <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border border-red-100 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Desconectar base de datos Neon de inmediato"
                  >
                    <Power size={11} /> Desconectar
                  </button>
                )}
              </div>

              {status.connected ? (
                <div className="mt-3.5 space-y-2 text-xs border-t border-emerald-200/40 pt-3">
                  <div>
                    <span className="font-extrabold text-[10px] font-mono text-emerald-750 block uppercase tracking-wider">
                      Línea de Conexión Activa:
                    </span>
                    <span className="font-mono text-[11px] bg-white/60 px-2 py-0.5 rounded border border-emerald-200/30 text-emerald-850 break-all select-all">
                      {status.connectionUrlMasked}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                    SIA ahora está leyendo y guardando de forma **altamente estructurada y relacional** en tu servidor PostgreSQL en Neon.
                  </p>
                </div>
              ) : (
                <div className="mt-2.5 text-[11px] text-slate-500 font-medium leading-relaxed">
                  Para conectar con Neon Postgres, ingresa la cadena de conexión de tu panel en **neon.tech** y presiona conectar. El sistema creará las tablas automáticamente.
                </div>
              )}

              {status.error && !status.connected && (
                <div className="mt-3 bg-red-50 border border-red-100 text-red-800 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-widest font-mono block">
                      Último Error de Conexión
                    </span>
                    <p className="font-mono text-[10px] bg-red-100/40 p-1.5 rounded text-red-800 break-all">
                      {status.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback message indicator */}
          {feedback && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${feedback.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"}`}>
              {feedback.type === "success" ? (
                <CheckCircle size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-rose-700 shrink-0 mt-0.5" />
              )}
              <p className="text-xs font-semibold leading-relaxed">{feedback.msg}</p>
            </div>
          )}

          {/* Connection form (Only if not connected) */}
          {status && !status.connected && (
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono block">
                  Cadena de Conexión Neon Postgres (ConnectionString)
                </label>
                <textarea
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="Ej. postgresql://usuario:clave@ep-cool-butterfly-123.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 text-xs rounded-2xl focus:bg-white font-mono outline-none focus:border-indigo-500 transition-all shadow-2xs resize-none"
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-700 hover:bg-indigo-650 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-700/10"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Conectando y creando tablas...
                  </>
                ) : (
                  <>
                    <Database size={13} /> Conectar Base de Datos
                  </>
                )}
              </button>
            </form>
          )}

          {/* Migration section */}
          {status && status.connected && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-150/40 rounded-2xl space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Play size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-tight">
                    Migrar Datos Locales a Neon Postgres
                  </h4>
                  <p className="text-[11px] text-indigo-750 font-medium leading-relaxed mt-0.5">
                    Haga clic aquí para subir y transferir toda la información que visualice en la pantalla (todas las estaciones de trabajo, bodega, licencias, áreas y bitácora de auditorías) de forma estructurada a su Postgres.
                  </p>
                </div>
              </div>

              <button
                onClick={handleMigrate}
                disabled={isMigrating || isLoading}
                className="w-full py-3 bg-indigo-700 hover:bg-indigo-650 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {isMigrating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Migrando registros...
                  </>
                ) : (
                  <>
                    🚀 Iniciar Migración a Postgres
                  </>
                )}
              </button>
            </div>
          )}

          {/* Documentation & Help instructions */}
          <div className="border-t border-slate-100 pt-5 space-y-2 text-xs text-slate-500">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">
              💡 ¿Cómo obtener tus credenciales en Neon?
            </span>
            <ol className="list-decimal pl-4.5 space-y-1 text-[11px] leading-relaxed">
              <li>Inicia sesión en su consola en <a href="https://neon.tech" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">neon.tech</a>.</li>
              <li>Cree un proyecto de Postgres (versión 15/16).</li>
              <li>En el panel "Connection Details", seleccione como lenguaje <b>"node.js"</b> o elija <b>"Connection String"</b>.</li>
              <li>Copie todo el texto que comienza con <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-700">postgresql://...</code> y péguelo en este modal.</li>
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3.5 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-150 rounded-xl text-xs font-extrabold text-slate-700 uppercase tracking-wider transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
