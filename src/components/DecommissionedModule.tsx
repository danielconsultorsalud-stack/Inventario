import React, { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, ShieldOff, Layers, Search, ChevronDown, ChevronUp } from "lucide-react";
import { DecommissionedItem, ComponentType } from "../types";

interface DecommissionedModuleProps {
  items: DecommissionedItem[];
  componentTypes: ComponentType[];
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

export const DecommissionedModule: React.FC<DecommissionedModuleProps> = ({
  items,
  componentTypes,
  onRestore,
  onPurge,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const getTypeName = (typeId: string) => {
    const matched = componentTypes.find((t) => t.id === typeId);
    return matched ? matched.name : typeId;
  };

  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.serial || "").toLowerCase().includes(term) ||
      item.reason.toLowerCase().includes(term) ||
      getTypeName(item.type).toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden transition-all duration-300">
      {/* HEADER BAR */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 cursor-pointer select-none hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-105 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 shadow-xs">
            <ShieldOff size={20} className="text-slate-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 font-sans">
              Historial de Equipos y Componentes de Baja
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">
              Registro formal de activos retirados de servicio, fallados u obsoletos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-[10px] font-black font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
            {items.length} REGISTROS
          </span>
          <div className="hover:text-slate-700 p-1 rounded-lg">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in text-slate-900">
          {/* SEARCH BAR */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              placeholder="Buscar en el registro de bajas... (Nombre, S/N, Motivo o Clasificación)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-red-500 text-xs px-10 py-3 rounded-xl transition-all outline-none text-slate-800 placeholder-slate-400 font-semibold"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 border border-dashed border-slate-150 rounded-2xl flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-slate-800 font-bold text-xs">No se encontraron equipos dados de baja</p>
                <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                  {searchTerm ? "Intenta con otros términos de búsqueda." : "El hardware dado de baja se listará formalmente en este panel."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-150 rounded-2xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-450 uppercase tracking-wider text-[9px] font-bold border-b border-slate-150 font-mono">
                    <th className="py-3 px-4">Componente de TI</th>
                    <th className="py-3 px-4">Clasificación</th>
                    <th className="py-3 px-4">Nº de Serie</th>
                    <th className="py-3 px-4 text-center">Unidades</th>
                    <th className="py-3 px-4">Motivo de la Baja</th>
                    <th className="py-3 px-4">Fecha de Retiro</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase font-mono">
                          {getTypeName(item.type)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                        {item.serial || <span className="text-slate-350">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-rose-600 bg-rose-50/30">
                        {item.quantity} ud
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 text-xs text-amber-850 font-bold bg-amber-50/50 px-2.5 py-1 rounded-lg border border-amber-100/40">
                          ⚠️ {item.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[10px] font-mono">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onRestore(item.id)}
                            className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold font-mono border border-emerald-100"
                            title="Restaurar componente del desecho y regresarlo al stock libre"
                          >
                            <RotateCcw size={12} />
                            Reincorporar
                          </button>
                          <button
                            type="button"
                            onClick={() => onPurge(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Purgar registro definitivo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
