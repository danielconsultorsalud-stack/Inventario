import React, { useState, useRef } from "react";
import { X, Download, Upload, AlertTriangle, CheckCircle, Database, FileText, ChevronRight, RefreshCw, Cloud, CloudOff, Info } from "lucide-react";
import { Area, Database as AppDatabase, License, InventoryItem, ComponentType, AuditLogEntry } from "../types";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: AppDatabase;
  componentTypes: ComponentType[];
  areas: Area[];
  licenses: License[];
  inventoryItems: InventoryItem[];
  auditLogs: AuditLogEntry[];
  onRestoreBackup: (backupData: {
    database: AppDatabase;
    componentTypes: ComponentType[];
    areas: Area[];
    licenses: License[];
    inventoryItems: InventoryItem[];
    auditLogs: AuditLogEntry[];
  }) => void;
  cloudSyncId: string;
  onSetCloudSyncId: (id: string) => void;
  isSyncing: boolean;
  onSyncNow: (targetId?: string) => Promise<void>;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  database,
  componentTypes,
  areas,
  licenses,
  inventoryItems,
  auditLogs,
  onRestoreBackup,
  cloudSyncId,
  onSetCloudSyncId,
  isSyncing,
  onSyncNow,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<{
    database?: AppDatabase;
    componentTypes?: ComponentType[];
    areas?: Area[];
    licenses?: License[];
    inventoryItems?: InventoryItem[];
    auditLogs?: AuditLogEntry[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [localSyncId, setLocalSyncId] = useState(cloudSyncId);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Export/Download Backup
  const handleExportBackup = () => {
    try {
      const backupPayload = {
        version: "v5.backup",
        timestamp: new Date().toISOString(),
        database,
        componentTypes,
        areas,
        licenses,
        inventoryItems,
        auditLogs,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `sia_cloud_backup_${dateStr}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg("Error al generar el archivo JSON de respaldo.");
    }
  };

  // Helper validation and loading function
  const validateAndLoadFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsedData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Schema validation - checking for top level keys
        if (!parsed) {
          throw new Error("El archivo está vacío o es inválido.");
        }

        // Validate basic keys existence - we can allow partial as long as main fields are formatted
        const hasDb = parsed.database !== undefined;
        const hasAreas = parsed.areas !== undefined;
        const hasLicenses = parsed.licenses !== undefined;
        const hasInventory = parsed.inventoryItems !== undefined;

        if (!hasDb && !hasAreas && !hasLicenses && !hasInventory) {
          throw new Error(
            "Formato de respaldo no reconocido. Debe contener la base de datos de puestos o componentes de inventario."
          );
        }

        // Pre-validate individual types if they are arrays/objects
        if (parsed.database && typeof parsed.database !== "object") {
          throw new Error("El campo 'database' de equipos es inválido.");
        }
        if (parsed.areas && !Array.isArray(parsed.areas)) {
          throw new Error("El campo 'areas' es inválido.");
        }
        if (parsed.licenses && !Array.isArray(parsed.licenses)) {
          throw new Error("El campo 'licenses' es inválido.");
        }
        if (parsed.inventoryItems && !Array.isArray(parsed.inventoryItems)) {
          throw new Error("El campo 'inventoryItems' es inválido.");
        }
        if (parsed.componentTypes && !Array.isArray(parsed.componentTypes)) {
          throw new Error("El campo 'componentTypes' es inválido.");
        }

        setParsedData({
          database: parsed.database || {},
          componentTypes: parsed.componentTypes || [],
          areas: parsed.areas || [],
          licenses: parsed.licenses || [],
          inventoryItems: parsed.inventoryItems || [],
          auditLogs: parsed.auditLogs || [],
        });
      } catch (err: any) {
        setErrorMsg(err?.message || "No se pudo interpretar el archivo JSON.");
      }
    };

    reader.onerror = () => {
      setErrorMsg("Error al leer el archivo de respaldo.");
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndLoadFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndLoadFile(e.dataTransfer.files[0]);
    }
  };

  // Confirm recovery action
  const handleConfirmRestore = () => {
    if (!parsedData) return;

    try {
      onRestoreBackup({
        database: parsedData.database || {},
        componentTypes: parsedData.componentTypes && parsedData.componentTypes.length > 0 ? parsedData.componentTypes : componentTypes,
        areas: parsedData.areas && parsedData.areas.length > 0 ? parsedData.areas : areas,
        licenses: parsedData.licenses && parsedData.licenses.length > 0 ? parsedData.licenses : licenses,
        inventoryItems: parsedData.inventoryItems && parsedData.inventoryItems.length > 0 ? parsedData.inventoryItems : inventoryItems,
        auditLogs: parsedData.auditLogs && parsedData.auditLogs.length > 0 ? parsedData.auditLogs : [],
      });

      setSuccessMsg("¡Toda la información se ha restaurado con éxito desde la copia de seguridad!");
      setParsedData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 2500);
    } catch (err) {
      setErrorMsg("Ocurrió un error inesperado al aplicar la restauración.");
    }
  };

  const handleConnectCloud = async () => {
    if (!localSyncId.trim()) {
      setErrorMsg("Por favor, ingresa un código de sincronización válido.");
      return;
    }
    const targetId = localSyncId.trim();
    setIsCloudLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      onSetCloudSyncId(targetId);
      setSuccessMsg("¡Conectando exitosamente a la Nube SIA! Iniciando descarga de datos...");
      setTimeout(async () => {
        try {
          await onSyncNow(targetId);
          setSuccessMsg("¡Nube conectada y datos sincronizados en tiempo real!");
        } catch (err: any) {
          console.error("Firestore sync error:", err);
          setErrorMsg(err?.message || "No hay datos guardados aún con este código. Tu navegador actual cargará su base de datos local actual en la nube.");
        } finally {
          setIsCloudLoading(false);
          // Set timeout to close modal or reset success message
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }, 1000);
    } catch (err) {
      setErrorMsg("Error de conexión al servidor de sincronización.");
      setIsCloudLoading(false);
    }
  };

  const handleDisconnectCloud = () => {
    onSetCloudSyncId("");
    setLocalSyncId("");
    setSuccessMsg("Se desactivó la Sincronización en la Nube. Volviendo al estado de almacenamiento local.");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleGenerateCode = () => {
    const randomCode = "SIA-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    setLocalSyncId(randomCode);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-fade-in animate-duration-200 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-700 border border-red-100/50">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">
                Respaldo de Información
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">
                Descarga copias de seguridad de SIA para restaurar tus datos en caso de cambios
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">

          {/* STATE INFOS */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100/50 text-rose-800 text-xs p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold uppercase tracking-wider text-[9px] font-mono text-rose-700 mb-0.5">Error de validación</p>
                <p className="font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100/50 text-emerald-800 text-xs p-4 rounded-2xl flex items-start gap-3">
              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold uppercase tracking-wider text-[9px] font-mono text-emerald-700 mb-0.5">Éxito en proceso</p>
                <p className="font-medium">{successMsg}</p>
              </div>
            </div>
          )}

          {/* SECCIÓN CLOUD SYNC */}
          <div className="bg-gradient-to-br from-slate-50 to-red-50/20 border border-slate-200/80 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Cloud size={20} className="text-red-700" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                Sincronización en la Nube SIA (Para Netlify e Incógnito)
              </h4>
            </div>

            <div className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
              <p>
                <span className="font-bold text-slate-800">¿Por qué tus datos cambian de forma independiente en Netlify o Modo Incógnito?</span>
              </p>
              <p>
                Netlify es una red de distribución estática (no puede ejecutar tu servidor de base de datos integrado de forma persistente). Por ello, por defecto SIA guarda el diseño de tus puestos de oficina y stock de forma aislada en la memoria (<code className="bg-slate-100 px-1 py-0.5 rounded text-red-700 font-mono">localStorage</code>) de tu navegador local.
              </p>
              <p>
                Al habilitar la <span className="font-bold text-slate-800">Nube SIA</span>, todas tus pestañas de incógnito, Netlify y dispositivos móviles compartirán <span className="font-bold text-red-700">exactamente la misma información</span> en tiempo real sin importar dónde se abra el sitio web.
              </p>
            </div>

            {/* Cloud Status */}
            <div className="p-4 bg-white border border-slate-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-500">Estado de Red: </span>
                  <span className="font-black text-emerald-700 uppercase font-mono">Nube Conectada Automáticamente</span>
                </div>
              </div>
              
              <div className="text-xs flex items-center gap-2">
                <span className="bg-emerald-50 border border-emerald-100/80 text-emerald-800 px-3 py-1 rounded-xl font-mono font-bold text-[10px] shadow-2xs">
                  Código Enlace: {cloudSyncId}
                </span>
              </div>
            </div>

            {/* Locked connection message */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-xs text-emerald-950 flex items-center gap-2.5 font-medium leading-relaxed">
              <span className="text-emerald-700 font-extrabold font-mono text-xs bg-emerald-100 px-2 py-0.5 rounded-lg">SIA CLOUD</span>
              <span>
                Conexión automática y segura activa. Todas tus modificaciones se guardan y sincronizan en la Nube SIA en tiempo real.
              </span>
            </div>
          </div>

          {/* EXPORT PANEL */}
          <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-3xl flex flex-col [@media(min-width:540px)]:flex-row [@media(min-width:540px)]:items-center justify-between gap-4">
            <div className="space-y-1 max-w-sm">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                1. Descargar Respaldo Total
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Empaqueta y descarga todo el estado actual sistema: computadores, componentes, stock de almacén, áreas corporativas y bitácoras de cambios en un único archivo serializado.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider px-5 py-3.5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Download size={13} className="text-slate-250" />
              Guardar Copia JSON
            </button>
          </div>

          {/* IMPORT PANEL */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              2. Cargar Repositorio o Copia de Respaldo
            </h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Sube un archivo de respaldo previamente descargado para sobrescribir y restablecer la base de datos de SIA en este navegador. 
            </p>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer text-center ${
                dragActive
                  ? "border-red-500 bg-red-50/20"
                  : "border-slate-200 bg-slate-50/10 hover:bg-slate-50/40"
              }`}
            >
              <Upload className="text-slate-400 mb-2" size={24} />
              <p className="text-xs font-bold text-slate-700">
                Arrastra tu archivo JSON aquí o <span className="text-red-700 underline">haz clic para examinar</span>
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Soporta formatos tipo sia_cloud_backup_*.json</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          {/* VISUAL FILE SUMMARY CARDS */}
          {parsedData && (
            <div className="bg-red-50/20 border border-red-100/50 rounded-3xl p-6 space-y-4 animate-fade-in animate-duration-300">
              <div className="flex items-center gap-2">
                <FileText className="text-red-700" size={16} />
                <h5 className="text-[11px] font-black tracking-widest uppercase font-mono text-red-800">
                  Resumen de Datos Identificados para Restauración
                </h5>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Computadores</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {Object.keys(parsedData.database || {}).length} puestos
                  </span>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Tipos Componentes</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parsedData.componentTypes?.length || 0} categorías
                  </span>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Áreas</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parsedData.areas?.length || 0} depto/áreas
                  </span>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Software Licencias</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parsedData.licenses?.length || 0} configuradas
                  </span>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Inventario Stock</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parsedData.inventoryItems?.length || 0} componentes
                  </span>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl px-4 py-2 text-xs">
                  <span className="block text-[8px] font-black text-slate-400 uppercase font-mono tracking-wider">Log Cambios</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {parsedData.auditLogs?.length || 0} eventos
                  </span>
                </div>
              </div>

              <div className="bg-white border border-rose-100 rounded-2xl p-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={14} />
                <p className="text-rose-800 font-medium leading-relaxed">
                  <strong className="font-bold">Advertencia importante:</strong> Al continuar, se reemplazarán de manera irrevocable todos los datos guardados actualmente en este navegador por la información de este archivo de respaldo.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setParsedData(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRestore}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider py-3 rounded-2xl transition-all shadow-md shadow-red-700/10 cursor-pointer flex items-center justify-center gap-1"
                >
                  Confirmar Restauración
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
