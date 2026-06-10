import React, { useState } from "react";
import { X, Plus, Trash2, Edit2, Check } from "lucide-react";
import { Area } from "../types";

interface AreaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  areas: Area[];
  onAddArea: (name: string, color: string) => void;
  onRemoveArea: (index: number) => void;
  onUpdateArea: (index: number, newName: string, newColor: string) => void;
}

const PALETA = ["#3b82f6", "#10b981", "#f43f5e", "#fbbf24", "#a855f7", "#06b6d4", "#f97316", "#6366f1"];

export const AreaManagerModal: React.FC<AreaManagerModalProps> = ({
  isOpen,
  onClose,
  areas,
  onAddArea,
  onRemoveArea,
  onUpdateArea,
}) => {
  const [newAreaName, setNewAreaName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newAreaName.trim();
    if (!trimmed) return;
    const color = PALETA[areas.length % PALETA.length];
    onAddArea(trimmed, color);
    setNewAreaName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    onUpdateArea(index, trimmed, editingColor);
    setEditingIndex(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-fade-in animate-duration-200 relative overflow-hidden">
        
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">Gestión de Áreas</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2.5 mb-8">
          <input
            type="text"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nueva área..."
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:bg-white focus:border-red-500 transition-all font-medium placeholder-slate-400"
          />
          <button
            onClick={handleAdd}
            className="bg-red-700 hover:bg-red-650 text-white px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm font-sans shrink-0 whitespace-nowrap"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {areas.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic font-semibold">
              No hay áreas registradas. Crea una para colorear los puestos.
            </div>
          ) : (
            areas.map((a, i) => {
              const isEditing = editingIndex === i;
              return (
                <div
                  key={i}
                  className="flex justify-between items-start bg-slate-50 p-3.5 rounded-2xl border border-slate-100 gap-2 font-sans"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{
                        backgroundColor: isEditing ? editingColor : a.color,
                        boxShadow: `0 0 4px ${isEditing ? editingColor : a.color}80`,
                      }}
                    />
                    {isEditing ? (
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(i);
                            } else if (e.key === "Escape") {
                              setEditingIndex(null);
                            }
                          }}
                          className="w-full bg-white border border-slate-205 text-slate-800 px-2.5 py-1 rounded-lg text-xs outline-none focus:border-red-500 font-bold"
                          autoFocus
                        />
                        {/* Paleta de colores para edición */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {PALETA.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setEditingColor(hex)}
                              className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                                editingColor === hex ? "border-slate-800 scale-120 ring-2 ring-slate-100" : "border-slate-250"
                              }`}
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                          <div className="relative flex items-center justify-center shrink-0">
                            <input
                              type="color"
                              value={editingColor}
                              onChange={(e) => setEditingColor(e.target.value)}
                              className="w-4 h-4 rounded-full border border-slate-250 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                              title="Color personalizado"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-700 font-bold break-words pr-1 mt-0.5">{a.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(i)}
                          className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                          title="Guardar"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Cancelar"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndex(i);
                            setEditingName(a.name);
                            setEditingColor(a.color);
                          }}
                          className="text-amber-600 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveArea(i)}
                          className="text-rose-500/60 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
