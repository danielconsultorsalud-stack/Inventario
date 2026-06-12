import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { Database } from "../types";

interface WorkspaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: Database;
  onSaveConfig: (newConfig: any) => void;
}

export const WorkspaceConfigModal: React.FC<WorkspaceConfigModalProps> = ({
  isOpen,
  onClose,
  database,
  onSaveConfig,
}) => {
  const [oficinaCarlos, setOficinaCarlos] = useState("Oficina Carlos");
  const [pCarlosMain, setPCarlosMain] = useState("Puesto Principal");
  const [pCarlosIt, setPCarlosIt] = useState("IT");
  const [salaJuntas, setSalaJuntas] = useState("Sala de Juntas");
  const [oficinaGerencia, setOficinaGerencia] = useState("Oficina Gerencia");
  const [mesaA, setMesaA] = useState("Mesa A");
  const [mesaB, setMesaB] = useState("Mesa B");
  const [mesaC, setMesaC] = useState("Mesa C");
  const [mesaD, setMesaD] = useState("Mesa D");

  useEffect(() => {
    if (isOpen) {
      const config = (database && database["_workspace_config"]) || {};
      setOficinaCarlos((config.oficinaCarlos as string) || "Oficina Carlos");
      setPCarlosMain((config.pCarlosMain as string) || "Puesto Principal");
      setPCarlosIt((config.pCarlosIt as string) || "IT");
      setSalaJuntas((config.salaJuntas as string) || "Sala de Juntas");
      setOficinaGerencia((config.oficinaGerencia as string) || "Oficina Gerencia");
      setMesaA((config.mesaA as string) || "Mesa A");
      setMesaB((config.mesaB as string) || "Mesa B");
      setMesaC((config.mesaC as string) || "Mesa C");
      setMesaD((config.mesaD as string) || "Mesa D");
    }
  }, [isOpen, database]);

  if (!isOpen) return null;

  const handleSave = () => {
    const newConfig = {
      oficinaCarlos: oficinaCarlos.trim() || "Oficina Carlos",
      pCarlosMain: pCarlosMain.trim() || "Puesto Principal",
      pCarlosIt: pCarlosIt.trim() || "IT",
      salaJuntas: salaJuntas.trim() || "Sala de Juntas",
      oficinaGerencia: oficinaGerencia.trim() || "Oficina Gerencia",
      mesaA: mesaA.trim() || "Mesa A",
      mesaB: mesaB.trim() || "Mesa B",
      mesaC: mesaC.trim() || "Mesa C",
      mesaD: mesaD.trim() || "Mesa D",
    };
    onSaveConfig(newConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl animate-fade-in animate-duration-200 relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">
              Personalizar Nombres
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">
              Personaliza las Oficinas y Mesas del Mapa
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="space-y-6 overflow-y-auto pr-2 pb-4 scrollbar-thin flex-1 font-sans">
          
          <div className="p-3 bg-red-50 border border-red-100 text-[10.5px] leading-relaxed text-red-900 rounded-xl">
            <strong>💡 Personalización Inteligente:</strong> Los cambios que realices aquí se reflejarán instantáneamente en todo el mapa de puestos, asignaciones de licencias, módulos de inventario y PDF generados. Además, se sincronizarán en la nube de forma permanente.
          </div>

          {/* Secciones de Oficinas y Salas */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b border-slate-100 pb-1">
              Oficinas y Salas de Reunión
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Oficina Principal (Carlos)</label>
                <input
                  type="text"
                  value={oficinaCarlos}
                  onChange={(e) => setOficinaCarlos(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Oficina Carlos"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Puesto Gerente (Principal)</label>
                <input
                  type="text"
                  value={pCarlosMain}
                  onChange={(e) => setPCarlosMain(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Puesto Principal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Puesto Auxiliar IT</label>
                <input
                  type="text"
                  value={pCarlosIt}
                  onChange={(e) => setPCarlosIt(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="IT"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Sala de Juntas</label>
                <input
                  type="text"
                  value={salaJuntas}
                  onChange={(e) => setSalaJuntas(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Sala de Juntas"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block">Oficina de Gerencia</label>
                <input
                  type="text"
                  value={oficinaGerencia}
                  onChange={(e) => setOficinaGerencia(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Oficina Gerencia"
                />
              </div>
            </div>
          </div>

          {/* Secciones de Mesas Comunes */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono border-b border-slate-100 pb-1">
              Mesas de Trabajo Comunes
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Mesa A (Puestos 1 - 4)</label>
                <input
                  type="text"
                  value={mesaA}
                  onChange={(e) => setMesaA(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Mesa A"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Mesa B (Puestos 5 - 10)</label>
                <input
                  type="text"
                  value={mesaB}
                  onChange={(e) => setMesaB(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Mesa B"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Mesa C (Puestos 11 - 16)</label>
                <input
                  type="text"
                  value={mesaC}
                  onChange={(e) => setMesaC(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Mesa C"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">Mesa D (Puestos 17 - 19)</label>
                <input
                  type="text"
                  value={mesaD}
                  onChange={(e) => setMesaD(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-red-400 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:bg-white transition-all"
                  placeholder="Mesa D"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer font-sans"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="bg-red-700 hover:bg-red-650 text-white px-6 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-700/15"
          >
            <Check size={12} strokeWidth={2.5} /> Guardar Nombres
          </button>
        </div>

      </div>
    </div>
  );
};
