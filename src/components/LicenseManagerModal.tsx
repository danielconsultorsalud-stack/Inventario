import React, { useState } from "react";
import { X, Plus, Trash2, KeyRound, Edit2, Check } from "lucide-react";
import { License, Database, AssetData } from "../types";

interface LicenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenses: License[];
  onAddLicense: (name: string, limit: number) => void;
  onRemoveLicense: (id: string) => void;
  onUpdateLicenseName: (id: string, name: string) => void;
  database: Database;
}

export const LicenseManagerModal: React.FC<LicenseManagerModalProps> = ({
  isOpen,
  onClose,
  licenses,
  onAddLicense,
  onRemoveLicense,
  onUpdateLicenseName,
  database,
}) => {
  const [newLicenseName, setNewLicenseName] = useState("");
  const [newLicenseLimit, setNewLicenseLimit] = useState<number | "">("");
  const [expandedLicenseId, setExpandedLicenseId] = useState<string | null>(null);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [editingLicenseName, setEditingLicenseName] = useState("");

  if (!isOpen) return null;

  const handleSaveLicenseEdit = (id: string) => {
    const trimmed = editingLicenseName.trim();
    if (!trimmed) return;
    onUpdateLicenseName(id, trimmed);
    setEditingLicenseId(null);
  };

  // Count how many equipos are using each license id
  const getLicenseCount = (licenseId: string) => {
    const assets = Object.values(database) as AssetData[];
    return assets.filter((asset) => {
      if (!asset) return false;
      const ids = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
      return ids.includes(licenseId);
    }).length;
  };

  const getFriendlyPuestoName = (id: string, name?: string) => {
    if (name) return name;
    if (id === "p-of-carlos") return "Oficina Carlos (Puesto Principal)";
    if (id === "p-it") return "Oficina Carlos (Mesa IT)";
    if (id === "p-juntas") return "Sala de Juntas";
    if (id === "p-gerencia") return "Oficina Gerencia";
    if (id.startsWith("p-")) {
      const num = id.split("-")[1];
      let location = "Mesa Común";
      const pNum = Number(num);
      if (pNum >= 1 && pNum <= 4) location = "Mesa A";
      else if (pNum >= 5 && pNum <= 10) location = "Mesa B";
      else if (pNum >= 11 && pNum <= 16) location = "Mesa C";
      return `Puesto ${num} (${location})`;
    }
    return id;
  };

  const handleAdd = () => {
    const trimmedName = newLicenseName.trim();
    if (!trimmedName) return;

    const limit = Number(newLicenseLimit);
    if (!limit || limit <= 0) {
      alert("Por favor, ingresa un límite válido mayor a 0 para los equipos.");
      return;
    }

    onAddLicense(trimmedName, limit);
    setNewLicenseName("");
    setNewLicenseLimit("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-700 shadow-sm border border-red-100">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Gestión de Licencias</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Control de límites y asignación
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

        {/* INPUT FORM */}
        <div className="space-y-4 mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-100">
          <div className="space-y-1.5">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              Nombre de la Licencia
            </label>
            <input
              type="text"
              value={newLicenseName}
              onChange={(e) => setNewLicenseName(e.target.value)}
              placeholder="Ej. Windows 11 Enterprise, Office 365"
              className="w-full bg-white border border-slate-200 text-slate-850 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-sm"
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                Límite de Equipos
              </label>
              <input
                type="number"
                min="1"
                value={newLicenseLimit}
                onChange={(e) => setNewLicenseLimit(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Ej. 5"
                className="w-full bg-white border border-slate-200 text-slate-850 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-semibold placeholder-slate-400 shadow-sm font-mono"
                onKeyDown={handleKeyDown}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAdd}
                className="w-full h-[38px] bg-red-700 hover:bg-red-650 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-red-700/10 hover:shadow-red-600/15 font-sans"
              >
                <Plus size={14} /> Crear Licencia
              </button>
            </div>
          </div>
        </div>

        {/* LIST OF LICENSES */}
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-1">
            Licencias Registradas ({licenses.length})
          </label>
          
          {licenses.length === 0 ? (
            <div className="text-center py-8 text-slate-450 text-xs italic font-medium bg-slate-50/50 rounded-2xl border border-slate-100">
              No hay licencias registradas.
            </div>
          ) : (
            licenses.map((lic) => {
              const used = getLicenseCount(lic.id);
              const free = Math.max(0, lic.limit - used);
              const isFull = used >= lic.limit;

              const isExpanded = expandedLicenseId === lic.id;
              
              const assetsList = Object.entries(database) as [string, AssetData][];
              const licAssignments = assetsList.filter(([_, asset]) => {
                if (!asset) return false;
                const ids = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
                return ids.includes(lic.id);
              });

              return (
                <div
                  key={lic.id}
                  className={`bg-white border rounded-2xl flex flex-col p-3 transition-all duration-200 shadow-sm ${
                    isExpanded ? "border-red-300 ring-2 ring-red-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center gap-2 w-full">
                    {editingLicenseId === lic.id ? (
                      <div className="flex items-center gap-1.5 flex-1 p-1">
                        <input
                          type="text"
                          value={editingLicenseName}
                          onChange={(e) => setEditingLicenseName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveLicenseEdit(lic.id);
                            } else if (e.key === "Escape") {
                              setEditingLicenseId(null);
                            }
                          }}
                          className="bg-white border border-slate-205 text-slate-800 px-2 py-1 rounded-lg text-xs outline-none focus:border-red-500 font-bold flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveLicenseEdit(lic.id)}
                          className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer shrink-0"
                          title="Guardar nombre"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLicenseId(null)}
                          className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shrink-0"
                          title="Cancelar"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedLicenseId(isExpanded ? null : lic.id)}
                        className="space-y-1 flex-1 pr-1 text-left cursor-pointer select-none"
                        title="Hacer clic para expandir y ver quién tiene esta licencia"
                      >
                        <div className="flex items-center gap-1.5 font-sans">
                          <span className="text-xs font-extrabold text-slate-805 tracking-tight block hover:text-red-800 animate-fade-in text-left">
                            {lic.name}
                          </span>
                          <span className="text-[8px] bg-red-50 text-red-800 border border-red-100 font-mono px-1 py-0.2 rounded font-black shrink-0 select-none">
                            {isExpanded ? "▲ CERRAR" : "▼ VER ASIGNACIONES"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold font-mono text-slate-500">
                            Usadas: {used} / {lic.limit}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className={`text-[10px] font-black font-mono uppercase ${isFull ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded' : 'text-emerald-600'}`}>
                            {isFull ? "Excedido / Completo" : `${free} libres`}
                          </span>
                        </div>
                      </button>
                    )}
                    
                    {editingLicenseId !== lic.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLicenseId(lic.id);
                            setEditingLicenseName(lic.name);
                          }}
                          className="text-amber-600 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          title="Editar nombre de la licencia"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveLicense(lic.id)}
                          className="text-rose-500/70 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="Eliminar licencia"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Assignments Detail */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5 bg-slate-50/50 p-2 rounded-xl text-[10px] animate-fade-in">
                      <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px] block mb-1 font-mono">
                        Equipos vinculados ({licAssignments.length}):
                      </span>
                      {licAssignments.length === 0 ? (
                        <div className="text-slate-450 italic text-[10px] py-1 text-center font-sans">
                          Esta licencia no está asignada en ningún puesto.
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {licAssignments.map(([id, asset]) => (
                            <div key={id} className="flex justify-between items-center text-[10px] text-slate-700 bg-white border border-slate-150 p-1 px-2.5 rounded-lg shadow-3xs font-sans">
                              <span className="font-bold text-slate-800 truncate max-w-[170px]">
                                {getFriendlyPuestoName(id, asset.nombre_equipo)}
                              </span>
                              <span className="text-red-850 font-extrabold bg-red-50 border border-red-100 px-1.5 py-0.2 rounded text-[9px] font-mono whitespace-nowrap">
                                {asset.asignado_a || "Sin asignar"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
