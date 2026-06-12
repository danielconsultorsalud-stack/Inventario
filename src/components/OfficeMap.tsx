import React from "react";
import { Check, Pencil } from "lucide-react";
import { Database, Area } from "../types";

interface OfficeMapProps {
  database: Database;
  areas: Area[];
  onSelectPuesto: (id: string, label: string) => void;
  onMouseEnterPuesto: (e: React.MouseEvent, id: string) => void;
  onMouseLeavePuesto: () => void;
  onEditLabel?: (key: string, labelName: string) => void;
  customLabels?: {
    oficinaCarlos: string;
    pCarlosMain: string;
    pCarlosIt: string;
    salaJuntas: string;
    oficinaGerencia: string;
    mesaA: string;
    mesaB: string;
    mesaC: string;
    mesaD: string;
  };
}

export const OfficeMap: React.FC<OfficeMapProps> = ({
  database,
  areas,
  onSelectPuesto,
  onMouseEnterPuesto,
  onMouseLeavePuesto,
  onEditLabel,
  customLabels = {
    oficinaCarlos: "Oficina Carlos",
    pCarlosMain: "Puesto Principal",
    pCarlosIt: "IT",
    salaJuntas: "Sala de Juntas",
    oficinaGerencia: "Oficina Gerencia",
    mesaA: "Mesa A",
    mesaB: "Mesa B",
    mesaC: "Mesa C",
    mesaD: "Mesa D",
  },
}) => {
  // Helper to color and glow filled seats
  const getPuestoStyle = (id: string) => {
    const data = database[id];
    if (data && data.nombre_equipo && data.area_select) {
      const area = areas.find((a) => a.name === data.area_select);
      if (area) {
        return {
          borderColor: area.color,
          borderWidth: "2px",
          color: "#0F172A",
          backgroundColor: `${area.color}15`,
          boxShadow: `0 4px 12px ${area.color}15`,
          fontWeight: "700",
        };
      }
    }
    return {};
  };

  const isFilled = (id: string) => {
    return !!(database[id] && database[id].nombre_equipo);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      
      {/* COLUMNA IZQUIERDA: OFICINAS Y SALAS */}
      <div className="space-y-10">
        
        {/* Oficina Carlos */}
        <div className="border border-slate-200 rounded-[2rem] bg-white h-80 flex items-center justify-center relative shadow-sm p-6 overflow-hidden">
          {/* Main Carlos desk */}
          <button
            onClick={() => onSelectPuesto("p-of-carlos", `${customLabels.oficinaCarlos} (${customLabels.pCarlosMain})`)}
            onMouseEnter={(e) => onMouseEnterPuesto(e, "p-of-carlos")}
            onMouseLeave={onMouseLeavePuesto}
            style={getPuestoStyle("p-of-carlos")}
            className="w-full max-w-[12rem] min-h-[7rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
          >
            <div className="flex items-center gap-1.5 group/p border-b border-transparent hover:border-slate-200 transition-all">
              <span className="text-[10px] uppercase tracking-wider font-black text-slate-400">{customLabels.pCarlosMain}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLabel?.("pCarlosMain", customLabels.pCarlosMain);
                }}
                className="opacity-0 group-hover/p:opacity-100 focus:opacity-100 text-slate-450 hover:text-red-750 p-0.5 rounded cursor-pointer transition-all flex items-center justify-center"
                title="Editar"
              >
                <Pencil size={8.5} />
              </span>
            </div>
            <span className="text-xs font-bold text-slate-700 mt-0.5">{customLabels.oficinaCarlos}</span>
            {isFilled("p-of-carlos") && (() => {
              const data = database["p-of-carlos"];
              const area = areas.find((a) => a.name === data?.area_select);
              return (
                <div className="mt-1.5 w-full flex flex-col items-center min-w-0">
                  {data.asignado_a && (
                    <span className="text-[11px] font-bold text-slate-750 truncate max-w-full px-1">
                      {data.asignado_a}
                    </span>
                  )}
                  {data.area_select && (
                    <span 
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-0.5 max-w-full truncate"
                      style={{
                        backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                        color: area ? area.color : "#64748b"
                      }}
                    >
                      {data.area_select}
                    </span>
                  )}
                </div>
              );
            })()}
            {isFilled("p-of-carlos") && (
              <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md animate-scale-in">
                <Check size={10} strokeWidth={3} />
              </div>
            )}
          </button>

          {/* IT Desk in the top right corner */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => onSelectPuesto("p-it", `${customLabels.oficinaCarlos} (${customLabels.pCarlosIt})`)}
              onMouseEnter={(e) => onMouseEnterPuesto(e, "p-it")}
              onMouseLeave={onMouseLeavePuesto}
              style={getPuestoStyle("p-it")}
              className="w-28 min-h-[5.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
            >
              <div className="flex items-center gap-1 group/it leading-none mb-1 text-[9.5px] font-black tracking-wider text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                <span>{customLabels.pCarlosIt}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditLabel?.("pCarlosIt", customLabels.pCarlosIt);
                  }}
                  className="opacity-0 group-hover/it:opacity-100 focus:opacity-100 text-red-500 hover:text-red-800 cursor-pointer p-0.5 transition-all flex items-center justify-center ml-0.5"
                  title="Editar"
                >
                  <Pencil size={8} />
                </span>
              </div>
              {isFilled("p-it") ? (() => {
                const data = database["p-it"];
                const area = areas.find((a) => a.name === data?.area_select);
                return (
                  <div className="w-full flex flex-col items-center min-w-0">
                    {data.asignado_a && (
                      <span className="text-[10px] font-extrabold text-slate-705 truncate max-w-full leading-tight">
                        {data.asignado_a}
                      </span>
                    )}
                    {data.area_select && (
                      <span 
                        className="text-[7.5px] font-black uppercase tracking-wider px-1 py-0.5 rounded mt-0.5 max-w-full truncate"
                        style={{
                          backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                          color: area ? area.color : "#64748b"
                        }}
                      >
                        {data.area_select}
                      </span>
                    )}
                  </div>
                );
              })() : (
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Libre</span>
              )}
              {isFilled("p-it") && (
                <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white shadow-md">
                  <Check size={8} strokeWidth={3} />
                </div>
              )}
            </button>
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-[0.25em] uppercase font-mono group">
            <span>{customLabels.oficinaCarlos}</span>
            <button
              onClick={() => onEditLabel?.("oficinaCarlos", customLabels.oficinaCarlos)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-750 transition-all p-0.5 rounded-md hover:bg-slate-50 cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
        </div>

        {/* Mesa D (Puestos 17, 18, 19) */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
          <div className="absolute top-4 left-8 flex items-center gap-1.5 text-[9px] font-black text-red-700 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-md border border-red-100 font-mono group">
            <span>{customLabels.mesaD}</span>
            <button
              onClick={() => onEditLabel?.("mesaD", customLabels.mesaD)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-400 hover:text-red-700 transition-all p-0.5 rounded cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-5 justify-items-center mt-6">
            {["p-17", "p-18", "p-19"].map((id) => {
              const num = id.split("-")[1];
              const pData = database[id];
              return (
                <button
                  key={id}
                  onClick={() => onSelectPuesto(id, `Puesto ${num} (${customLabels.mesaD})`)}
                  onMouseEnter={(e) => onMouseEnterPuesto(e, id)}
                  onMouseLeave={onMouseLeavePuesto}
                  style={getPuestoStyle(id)}
                  className="w-full max-w-[8rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-2.5 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
                >
                  <span className="text-xs font-black text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded-md shrink-0">Puesto {num}</span>
                  {pData && pData.nombre_equipo && (() => {
                    const area = areas.find((a) => a.name === pData.area_select);
                    return (
                      <div className="mt-1.5 w-full flex flex-col items-center min-w-0">
                        {pData.asignado_a && (
                          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-705 truncate max-w-full px-1">
                            {pData.asignado_a}
                          </span>
                        )}
                        {pData.area_select && (
                          <span 
                            className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 max-w-full truncate"
                            style={{
                              backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                              color: area ? area.color : "#64748b"
                            }}
                          >
                            {pData.area_select}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {isFilled(id) && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sala de Juntas */}
        <div className="border border-slate-200 rounded-[2rem] bg-white h-44 flex items-center px-6 md:px-12 relative shadow-sm justify-center">
          <button
            onClick={() => onSelectPuesto("p-juntas", customLabels.salaJuntas)}
            onMouseEnter={(e) => onMouseEnterPuesto(e, "p-juntas")}
            onMouseLeave={onMouseLeavePuesto}
            style={getPuestoStyle("p-juntas")}
            className="w-full max-w-[14rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
          >
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">{customLabels.salaJuntas}</span>
            {isFilled("p-juntas") && (() => {
              const data = database["p-juntas"];
              const area = areas.find((a) => a.name === data?.area_select);
              return (
                <div className="mt-2 w-full flex flex-col items-center min-w-0">
                  {data.asignado_a && (
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-full px-1">
                      {data.asignado_a}
                    </span>
                  )}
                  {data.area_select && (
                    <span 
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 max-w-full truncate"
                      style={{
                        backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                        color: area ? area.color : "#64748b"
                      }}
                    >
                      {data.area_select}
                    </span>
                  )}
                </div>
              );
            })()}
            {isFilled("p-juntas") && (
              <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
                <Check size={10} strokeWidth={3} />
              </div>
            )}
          </button>
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-[0.25em] uppercase font-mono group">
            <span>{customLabels.salaJuntas}</span>
            <button
              onClick={() => onEditLabel?.("salaJuntas", customLabels.salaJuntas)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-750 transition-all p-0.5 rounded-md hover:bg-slate-50 cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
        </div>

        {/* Oficina Gerencia */}
        <div className="border border-slate-200 rounded-[2rem] bg-white h-44 flex items-center px-6 md:px-12 relative shadow-sm justify-center">
          <button
            onClick={() => onSelectPuesto("p-gerencia", customLabels.oficinaGerencia)}
            onMouseEnter={(e) => onMouseEnterPuesto(e, "p-gerencia")}
            onMouseLeave={onMouseLeavePuesto}
            style={getPuestoStyle("p-gerencia")}
            className="w-full max-w-[12rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
          >
            <span className="text-xs font-black uppercase tracking-wider text-purple-700">{customLabels.oficinaGerencia}</span>
            {isFilled("p-gerencia") && (() => {
              const data = database["p-gerencia"];
              const area = areas.find((a) => a.name === data?.area_select);
              return (
                <div className="mt-2 w-full flex flex-col items-center min-w-0">
                  {data.asignado_a && (
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-full px-1">
                      {data.asignado_a}
                    </span>
                  )}
                  {data.area_select && (
                    <span 
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-1 max-w-full truncate"
                      style={{
                        backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                        color: area ? area.color : "#64748b"
                      }}
                    >
                      {data.area_select}
                    </span>
                  )}
                </div>
              );
            })()}
            {isFilled("p-gerencia") && (
              <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
                <Check size={10} strokeWidth={3} />
              </div>
            )}
          </button>
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-[0.25em] uppercase font-mono group">
            <span>{customLabels.oficinaGerencia}</span>
            <button
              onClick={() => onEditLabel?.("oficinaGerencia", customLabels.oficinaGerencia)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-750 transition-all p-0.5 rounded-md hover:bg-slate-50 cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
        </div>

      </div>

      {/* COLUMNA DERECHA: MESAS COMUNES A, B, C, D */}
      <div className="space-y-10">
        
        {/* Mesa A */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
          <div className="absolute top-4 left-8 flex items-center gap-1.5 text-[9px] font-black text-red-700 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-md border border-red-100 font-mono group">
            <span>{customLabels.mesaA}</span>
            <button
              onClick={() => onEditLabel?.("mesaA", customLabels.mesaA)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-405 hover:text-red-700 transition-all p-0.5 rounded cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-5 md:gap-6 justify-items-center mt-6">
            {["p-1", "p-2", "p-3", "p-4"].map((id) => {
              const num = id.split("-")[1];
              const pData = database[id];
              return (
                <button
                  key={id}
                  onClick={() => onSelectPuesto(id, `Puesto ${num} (${customLabels.mesaA})`)}
                  onMouseEnter={(e) => onMouseEnterPuesto(e, id)}
                  onMouseLeave={onMouseLeavePuesto}
                  style={getPuestoStyle(id)}
                  className="w-full max-w-[10rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
                >
                  <span className="text-xs font-black text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded-md shrink-0">Puesto {num}</span>
                  {pData && pData.nombre_equipo && (() => {
                    const area = areas.find((a) => a.name === pData.area_select);
                    return (
                      <div className="mt-1.5 w-full flex flex-col items-center min-w-0">
                        {pData.asignado_a && (
                          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-705 truncate max-w-full px-1">
                            {pData.asignado_a}
                          </span>
                        )}
                        {pData.area_select && (
                          <span 
                            className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 max-w-full truncate"
                            style={{
                              backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                              color: area ? area.color : "#64748b"
                            }}
                          >
                            {pData.area_select}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {isFilled(id) && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md font-bold">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mesa B */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
          <div className="absolute top-4 left-8 flex items-center gap-1.5 text-[9px] font-black text-red-700 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-md border border-red-100 font-mono group">
            <span>{customLabels.mesaB}</span>
            <button
              onClick={() => onEditLabel?.("mesaB", customLabels.mesaB)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-405 hover:text-red-700 transition-all p-0.5 rounded cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-5 justify-items-center mt-6">
            {["p-5", "p-6", "p-7", "p-8", "p-9", "p-10"].map((id) => {
              const num = id.split("-")[1];
              const pData = database[id];
              return (
                <button
                  key={id}
                  onClick={() => onSelectPuesto(id, `Puesto ${num} (${customLabels.mesaB})`)}
                  onMouseEnter={(e) => onMouseEnterPuesto(e, id)}
                  onMouseLeave={onMouseLeavePuesto}
                  style={getPuestoStyle(id)}
                  className="w-full max-w-[8rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-2.5 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
                >
                  <span className="text-xs font-black text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded-md shrink-0">Puesto {num}</span>
                  {pData && pData.nombre_equipo && (() => {
                    const area = areas.find((a) => a.name === pData.area_select);
                    return (
                      <div className="mt-1.5 w-full flex flex-col items-center min-w-0">
                        {pData.asignado_a && (
                          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 truncate max-w-full px-1">
                            {pData.asignado_a}
                          </span>
                        )}
                        {pData.area_select && (
                          <span 
                            className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 max-w-full truncate"
                            style={{
                              backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                              color: area ? area.color : "#64748b"
                            }}
                          >
                            {pData.area_select}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {isFilled(id) && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mesa C */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
          <div className="absolute top-4 left-8 flex items-center gap-1.5 text-[9px] font-black text-red-700 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-md border border-red-100 font-mono group">
            <span>{customLabels.mesaC}</span>
            <button
              onClick={() => onEditLabel?.("mesaC", customLabels.mesaC)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-405 hover:text-red-700 transition-all p-0.5 rounded cursor-pointer flex items-center justify-center"
              title="Editar"
            >
              <Pencil size={8.5} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 md:gap-5 justify-items-center mt-6">
            {["p-11", "p-12", "p-13", "p-14", "p-15", "p-16"].map((id) => {
              const num = id.split("-")[1];
              const pData = database[id];
              return (
                <button
                  key={id}
                  onClick={() => onSelectPuesto(id, `Puesto ${num} (${customLabels.mesaC})`)}
                  onMouseEnter={(e) => onMouseEnterPuesto(e, id)}
                  onMouseLeave={onMouseLeavePuesto}
                  style={getPuestoStyle(id)}
                  className="w-full max-w-[8rem] min-h-[6.5rem] h-auto bg-slate-50 border border-slate-200/80 text-slate-500 hover:text-slate-800 rounded-2xl flex flex-col items-center justify-center p-2.5 cursor-pointer transition-all duration-205 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300 relative font-mono shadow-sm"
                >
                  <span className="text-xs font-black text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded-md shrink-0">Puesto {num}</span>
                  {pData && pData.nombre_equipo && (() => {
                    const area = areas.find((a) => a.name === pData.area_select);
                    return (
                      <div className="mt-1.5 w-full flex flex-col items-center min-w-0">
                        {pData.asignado_a && (
                          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-705 truncate max-w-full px-1">
                            {pData.asignado_a}
                          </span>
                        )}
                        {pData.area_select && (
                          <span 
                            className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 max-w-full truncate"
                            style={{
                              backgroundColor: area ? `${area.color}15` : "#e2e8f0",
                              color: area ? area.color : "#64748b"
                            }}
                          >
                            {pData.area_select}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {isFilled(id) && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-md">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
