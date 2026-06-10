import React, { useState } from "react";
import { X, Plus, Trash2, Edit2, Check, HelpCircle, Lock } from "lucide-react";
import { ComponentType, InventoryItem } from "../types";

export const SYSTEM_COMPONENT_IDS = [
  "board",
  "procesador",
  "ram",
  "almacenamiento",
  "video",
  "wifi",
  "monitor",
  "mouse",
  "teclado",
  "auriculares",
  "camara",
  "otros"
];

interface ComponentTypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentTypes: ComponentType[];
  inventoryItems: InventoryItem[];
  onAddComponentType: (name: string, icon: string) => void;
  onUpdateComponentType: (id: string, name: string, icon: string) => void;
  onDeleteComponentType: (id: string) => void;
}

const COMMON_EMOJIS = [
  "⚙️", "🧠", "💾", "💽", "🌐", "🔌", "🎮", "📶", "🖥️", "🖱️", "⌨️", "🎧", "📷", "🔋", "🔌", "💻", "📦", "🔊", "🖨️", "🔧"
];

export const ComponentTypeManagerModal: React.FC<ComponentTypeManagerModalProps> = ({
  isOpen,
  onClose,
  componentTypes,
  inventoryItems,
  onAddComponentType,
  onUpdateComponentType,
  onDeleteComponentType,
}) => {
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeIcon, setNewTypeIcon] = useState("⚙️");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    onAddComponentType(trimmed, newTypeIcon);
    setNewTypeName("");
    setNewTypeIcon("⚙️");
  };

  const startEdit = (type: ComponentType) => {
    setEditingId(type.id);
    setEditName(type.name);
    setEditIcon(type.icon);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdateComponentType(id, trimmed, editIcon);
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    // Check if any inventory item contains this type
    const count = inventoryItems.filter((item) => item.type === id).length;
    if (count > 0) {
      alert(
        `No se puede eliminar el tipo "${name}" porque está asociado a ${count} componente(s) en tu inventario. Elimina o cambia la clasificación de esos componentes primero.`
      );
      return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar el tipo de componente "${name}"?`)) {
      onDeleteComponentType(id);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[90] p-4 font-sans text-slate-950">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-fade-in animate-duration-200 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900 font-sans">Tipos de Componentes</h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">
              Personaliza las clasificaciones de hardware y stock
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-800 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ADD NEW TYPE FORM */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl mb-6 shrink-0 space-y-3">
          <h4 className="text-[10px] font-extrabold text-red-700 uppercase tracking-widest font-mono">
            Nuevo Clasificador
          </h4>
          <div className="flex gap-2.5 items-end">
            <div className="w-16">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1 font-mono">
                Icono / Emoji
              </label>
              <select
                value={newTypeIcon}
                onChange={(e) => setNewTypeIcon(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 px-2 py-2 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-semibold font-mono cursor-pointer shadow-2xs text-center"
              >
                {COMMON_EMOJIS.map((emo) => (
                  <option key={emo} value={emo}>
                    {emo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1 font-mono">
                Nombre de la Clasificación
              </label>
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ej. Fuentes de Almacenamiento..."
                className="w-full bg-white border border-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <button
              onClick={handleAdd}
              className="bg-red-700 hover:bg-red-600 text-white h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm shrink-0"
            >
              <Plus size={14} /> Crear
            </button>
          </div>
        </div>

        {/* LIST OF TYPES */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[40vh]">
          {componentTypes.map((type) => {
            const isEditing = editingId === type.id;
            return (
              <div
                key={type.id}
                className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors"
              >
                {isEditing ? (
                  <>
                    <div className="w-14">
                      <select
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-850 px-1 py-1 rounded-lg text-xs outline-none focus:border-red-500 text-center cursor-pointer"
                      >
                        {COMMON_EMOJIS.map((emo) => (
                          <option key={emo} value={emo}>
                            {emo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-850 px-2.5 py-1 rounded-lg text-xs outline-none focus:border-red-500 font-bold"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(type.id);
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(type.id)}
                      className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                      title="Guardar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-150 rounded-lg transition-all cursor-pointer text-xs font-bold"
                      title="Cancelar"
                    >
                      X
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm border border-slate-200/50 select-none">
                      {type.icon}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-slate-800 font-bold">{type.name}</span>
                      <span className="text-[9px] text-slate-400 block font-mono">ID: {type.id}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      {SYSTEM_COMPONENT_IDS.includes(type.id) ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200/50 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider font-mono select-none" title="Este componente es del sistema por defecto y no se puede modificar o eliminar.">
                          <Lock size={9} /> Sistema
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(type)}
                            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Modificar"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(type.id, type.name)}
                            className="text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar clasificación"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* EXPLANATORY TIPS */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2 text-[10px] text-slate-400 font-semibold font-mono shrink-0">
          <HelpCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span>Al editar o crear clasificaciones, aparecerán automáticamente en el menú de registro del stock y en los botes de categoría.</span>
        </div>
      </div>
    </div>
  );
};
