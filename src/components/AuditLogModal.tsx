import React, { useState } from "react";
import { X, Search, Trash2, Calendar, ClipboardList, Filter, Clock } from "lucide-react";
import { AuditLogEntry } from "../types";

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
  onClearLogs: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  if (!isOpen) return null;

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || log.action === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Unique actions for the filtering dropdown
  const actionCategories: string[] = Array.from(new Set(logs.map((log) => log.action)));

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("es-CO", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case "ACTUALIZAR_EQUIPO":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "APORTAR_STOCK":
      case "MODIFICAR_STOCK":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "ELIMINAR_STOCK":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "CREAR_AREA":
      case "ELIMINAR_AREA":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "CREAR_LICENCIA":
      case "ELIMINAR_LICENCIA":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "CREAR_CATEGORIA":
      case "MODIFICAR_CATEGORIA":
      case "ELIMINAR_CATEGORIA":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-fade-in animate-duration-200 flex flex-col max-h-[85vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-700 border border-red-100/50">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">
                Historial de Registro de Cambios
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">
                Bitácora de auditoría interna de actividades de la infraestructura TI
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

        {/* SEARCH AND FILTERS */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4 shrink-0">
          <div className="sm:col-span-7 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por equipo, responsable o cambio..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:bg-white focus:border-red-500 transition-all font-medium placeholder-slate-450 shadow-2xs"
            />
          </div>

          <div className="sm:col-span-5 flex gap-2">
            <div className="relative flex-1">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-8 pr-3 py-2 rounded-xl text-[11px] font-bold uppercase font-mono outline-none focus:border-red-500 transition-all cursor-pointer shadow-2xs"
              >
                <option value="all">Todas las acciones</option>
                {actionCategories.map((act) => (
                  <option key={act} value={act}>
                    {act.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {logs.length > 1 && (
              <button
                onClick={() => {
                  if (confirm("¿Estás absolutamente seguro de que deseas vaciar el historial de cambios? Esta acción no se puede deshacer.")) {
                    onClearLogs();
                  }
                }}
                className="bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 p-2 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Vaciar Historial"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* LOG PANEL LIST */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[300px] border border-slate-100 rounded-2xl bg-slate-50/20 p-4">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="text-slate-350 mb-3 animate-pulse" size={28} />
              <p className="text-slate-400 text-xs italic font-semibold">
                No se encontraron actividades registradas.
              </p>
              <p className="text-slate-450 text-[10px] font-medium max-w-[280px] mt-1 leading-normal font-mono uppercase tracking-wider">
                Intenta buscar otra palabra o realiza modificaciones en el sistema para generar bitácoras.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-slate-250/20 p-4 rounded-xl flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs hover:border-slate-200 transition-colors shadow-2xs relative overflow-hidden"
              >
                {/* Visual accent bar based on action type */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  log.action.includes("ELIMINAR") ? "bg-rose-500" : log.action.includes("CREAR") || log.action.includes("APORTAR") ? "bg-emerald-500" : "bg-blue-500"
                }`} />

                <div className="space-y-1.5 flex-1 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase font-mono px-2 py-0.5 rounded border ${getActionBadgeStyle(log.action)}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold font-mono flex items-center gap-1">
                      <Calendar size={11} className="text-slate-350" />
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-800 font-semibold leading-relaxed">
                    {log.description}
                  </p>
                </div>

                <div className="shrink-0 text-right flex md:flex-col items-center md:items-end justify-between md:justify-start gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-dashed border-slate-100">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">
                    Responsable:
                  </span>
                  <span className="text-[11px] font-bold text-slate-650 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 block">
                    {log.user}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* LOG VISUAL CAP SUMMARY */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold font-mono shrink-0">
          <span>Mostrando {filteredLogs.length} de {logs.length} bitácoras</span>
          <span className="text-red-750">Seguimiento en Tiempo Real Activo</span>
        </div>

      </div>
    </div>
  );
};
