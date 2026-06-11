import React, { useState, useEffect } from "react";
import { Plus, Trash2, Monitor, Mouse, Keyboard, Headphones, Video, Box, ChevronDown, ChevronUp, Cpu, HardDrive, Wifi, Layers, Edit2, ShieldAlert, X, Search } from "lucide-react";
import { InventoryItem, Database, ComponentType, AssetData } from "../types";

interface InventoryModuleProps {
  items: InventoryItem[];
  database: Database;
  componentTypes: ComponentType[];
  onAddItem: (item: Omit<InventoryItem, "id">) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDeleteItem: (id: string) => void;
  onOpenComponentTypeManager: () => void;
  onUpdateItem: (item: InventoryItem) => void;
  onDecommissionItem: (itemId: string, quantity: number, reason: string) => void;
}

// Global helper to count how many times an inventory item is assigned in all workstations
export const getActiveAssignmentsCount = (itemId: string, database: Database): number => {
  let count = 0;
  for (const desk of Object.values(database)) {
    if (!desk) continue;
    // Inspect all assigned property values dynamically to check if any matches this exact inventory item ID
    for (const val of Object.values(desk)) {
      if (val === itemId) {
        count++;
      }
    }
  }
  return count;
};

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  items,
  database,
  componentTypes,
  onAddItem,
  onUpdateQuantity,
  onDeleteItem,
  onOpenComponentTypeManager,
  onUpdateItem,
  onDecommissionItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(() => componentTypes[0]?.id || "board");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [decommissioningItem, setDecommissioningItem] = useState<InventoryItem | null>(null);
  const [decommissionQty, setDecommissionQty] = useState<number>(1);
  const [decommissionReason, setDecommissionReason] = useState<string>("Falla técnica irreparable");
  const [decommissionCustomNotes, setDecommissionCustomNotes] = useState("");
  const [selectedCategoryInfo, setSelectedCategoryInfo] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");

  const getFriendlyPuestoNameGlobal = (id: string, name?: string) => {
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
      else location = "Fila Principal";
      return `Puesto ${num} (${location})`;
    }
    return id;
  };

  const getFriendlySlotNameGlobal = (key: string) => {
    if (key === "board") return "Placa Madre";
    if (key === "procesador") return "Procesador";
    if (key.startsWith("ram")) return `RAM ${key.replace("ram", "")}`;
    if (key.startsWith("alm")) return `Almacenamiento ${key.replace("alm", "")}`;
    if (key.startsWith("mon")) return `Monitor ${key.replace("mon", "")}`;
    if (key === "video") return "T. Video";
    if (key === "wifi") return "Wifi/Red";
    if (key === "mouse") return "Mouse";
    if (key === "teclado") return "Teclado";
    if (key === "camara") return "Cámara";
    if (key === "auriculares") return "Audífonos";
    return key.toUpperCase();
  };

  const getAssignments = (itemId: string) => {
    const result: { id: string; user: string; name: string }[] = [];
    
    Object.entries(database).forEach(([deskId, rawDesk]) => {
      const desk = rawDesk as AssetData;
      if (!desk) return;
      
      // Look at all properties in the desk and gather match entries
      Object.entries(desk).forEach(([key, val]) => {
        if (val === itemId) {
          result.push({
            id: deskId,
            user: desk.asignado_a || "Sin asignar",
            name: `${getFriendlyPuestoNameGlobal(deskId, desk.nombre_equipo)} (${getFriendlySlotNameGlobal(key)})`,
          });
        }
      });
    });
    return result;
  };

  const getCategoryUserInfo = (catId: string) => {
    const list: {
      workstationId: string;
      workstationLabel: string;
      employee: string;
      assignedDeviceName: string;
      slotName: string;
    }[] = [];

    Object.entries(database).forEach(([deskId, rawDesk]) => {
      const desk = rawDesk as AssetData;
      if (!desk) return;

      Object.entries(desk).forEach(([key, val]) => {
        if (!val) return;

        // Check if `val` is a registered inventory item of this category
        const invItem = items.find((item) => item.id === val);
        let matches = false;
        let displayName = String(val);

        if (invItem) {
          if (invItem.type === catId) {
            matches = true;
            displayName = invItem.name;
          }
        } else {
          // Fallback: Check if key belongs to this category.
          let mappedCat = key;
          if (key.startsWith("ram")) mappedCat = "ram";
          else if (key.startsWith("alm")) mappedCat = "almacenamiento";
          else if (key.startsWith("mon")) mappedCat = "monitor";
          
          if (mappedCat === catId) {
            matches = true;
          }
        }

        if (matches) {
          list.push({
            workstationId: deskId,
            workstationLabel: getFriendlyPuestoNameGlobal(deskId, desk.nombre_equipo),
            employee: desk.asignado_a || "Sin asignar",
            assignedDeviceName: displayName,
            slotName: getFriendlySlotNameGlobal(key),
          });
        }
      });
    });

    return list;
  };

  // Keep type selected within available active classifications
  useEffect(() => {
    if (componentTypes.length > 0 && !componentTypes.some((t) => t.id === type)) {
      setType(componentTypes[0].id);
    }
  }, [componentTypes, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !type) return;

    const qty = Number(quantity) || 1;

    if (editingItemId) {
      // Safety validation: check if new quantity is less than assigned count
      const assigned = getActiveAssignmentsCount(editingItemId, database);
      if (qty < assigned) {
        alert(`No puedes reducir el stock por debajo de la cantidad de componentes que ya están asignados a equipos (${assigned} unidades).`);
        return;
      }
      onUpdateItem({
        id: editingItemId,
        name: trimmedName,
        type,
        quantity: qty,
        serial: serial.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setEditingItemId(null);
    } else {
      onAddItem({
        name: trimmedName,
        type,
        quantity: qty,
        serial: serial.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }

    // Reset inputs
    setName("");
    setQuantity(1);
    setSerial("");
    setNotes("");
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setName(item.name);
    setType(item.type);
    setQuantity(item.quantity);
    setSerial(item.serial || "");
    setNotes(item.notes || "");
    
    // Smoothly scroll to the form if helpful on mobile/long screens
    const formElement = document.querySelector("form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setName("");
    setType(componentTypes[0]?.id || "board");
    setQuantity(1);
    setSerial("");
    setNotes("");
  };

  // Icon and label matcher for hardware
  const getIconAndLabel = (typeId: string, size = 16) => {
    const matched = componentTypes.find((t) => t.id === typeId);

    const getStandardIcon = (id: string, className = "") => {
      switch (id) {
        case "board":
          return <Layers size={size} className={className} />;
        case "procesador":
          return <Cpu size={size} className={className} />;
        case "ram":
          return <Layers size={size} className={className} />;
        case "almacenamiento":
          return <HardDrive size={size} className={className} />;
        case "video":
          return <Monitor size={size} className={className} />;
        case "wifi":
          return <Wifi size={size} className={className} />;
        case "monitor":
          return <Monitor size={size} className={className} />;
        case "mouse":
          return <Mouse size={size} className={className} />;
        case "teclado":
          return <Keyboard size={size} className={className} />;
        case "auriculares":
          return <Headphones size={size} className={className} />;
        case "camara":
          return <Video size={size} className={className} />;
        default:
          return null;
      }
    };

    const stdColor = "text-red-700";
    const stdIcon = getStandardIcon(typeId, stdColor);

    if (matched) {
      return {
        icon: stdIcon || (
          <span className="text-sm font-semibold select-none leading-none" style={{ fontSize: "14px" }}>
            {matched.icon}
          </span>
        ),
        label: matched.name,
      };
    }

    return {
      icon: stdIcon || <Box size={size} className={stdColor} />,
      label: typeId,
    };
  };

  // Count items by category (Stock Total vs Stock Disponible)
  const getCategoryStats = (catType: string) => {
    const catItems = items.filter((item) => item.type === catType);
    const total = catItems.reduce((sum, item) => sum + item.quantity, 0);
    const assigned = catItems.reduce((sum, item) => {
      return sum + getActiveAssignmentsCount(item.id, database);
    }, 0);
    const free = Math.max(0, total - assigned);
    return { total, assigned, free };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden transition-all duration-300">
      
      {/* HEADER BAR */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 cursor-pointer select-none hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-700 shadow-xs border border-red-100/50">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 font-sans">
              Módulo de Almacén e Inventario de Hardware
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">
              Gestión de componentes y stock de TI en espera de asignación
            </p>
          </div>
        </div>
        <div className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in text-slate-900">
          
          {/* CATEGORY STATS GRID - DYNAMIC */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {componentTypes.map((cat) => {
              const { total, free } = getCategoryStats(cat.id);
              const { icon, label } = getIconAndLabel(cat.id, 16);

              const colorClassMap: Record<string, string> = {
                board: "text-purple-600 bg-purple-50 border-purple-100/50",
                procesador: "text-rose-600 bg-rose-50 border-rose-100/50",
                ram: "text-blue-600 bg-blue-50 border-blue-100/50",
                almacenamiento: "text-cyan-600 bg-cyan-50 border-cyan-100/50",
                video: "text-teal-600 bg-teal-50 border-teal-100/50",
                wifi: "text-amber-600 bg-amber-50 border-amber-100/50",
                monitor: "text-red-700 bg-red-50 border-red-100/50",
                mouse: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
                teclado: "text-orange-600 bg-orange-50 border-orange-100/50",
                auriculares: "text-violet-600 bg-violet-50 border-violet-100/50",
                camara: "text-pink-600 bg-pink-50 border-pink-100/50",
                otros: "text-slate-600 bg-slate-50 border-slate-200/50",
              };

              const colorClass = colorClassMap[cat.id] || "text-slate-600 bg-slate-50 border-slate-150";

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryInfo(cat.id)}
                  className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-2xl flex items-center gap-3 hover:translate-y-[-1.5px] hover:bg-slate-100/70 hover:border-slate-250 hover:shadow-2xs active:scale-98 transition-all duration-250 cursor-pointer text-left w-full relative group"
                  title={`Clic para ver quién tiene dispositivos del tipo: ${label}`}
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}>
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight block font-mono truncate">
                      {label}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-slate-800 font-mono">
                        {free}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        /{total} lib
                      </span>
                    </div>
                  </div>
                  
                  {/* Small absolute search indicator appearing on hover */}
                  <div className="absolute top-1 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-[8px] bg-white border border-slate-200 text-slate-450 font-extrabold px-1 py-0.5 rounded shadow-3xs font-sans">
                      🔍 Ver
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* ADD COMPONENT FORM */}
            <form onSubmit={handleSubmit} className="lg:col-span-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-extrabold text-red-700 uppercase tracking-widest font-mono border-b border-slate-200/60 pb-2 flex items-center gap-1.5">
                {editingItemId ? (
                  <>
                    <Edit2 size={13} className="text-amber-600 animate-pulse" /> Editar Componente
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Registrar Stock Libre
                  </>
                )}
              </h3>

              <div className="space-y-1.5 flex-1">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  Nombre completo del Componente / Modelo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. ASUS Prime Z690-P, Intel i7-12700K"
                  className="w-full bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                    Tipo de Componente
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium cursor-pointer shadow-2xs"
                  >
                    {componentTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.icon} {ct.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                    {editingItemId ? "Stock Total" : "Cantidad Inicial"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-mono font-bold shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  S/N u Código de Barras (Opcional)
                </label>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="Ej. SN: 910-005600, B450-M"
                  className="w-full bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  Notas de Estado / Almacenamiento (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Caja original, estante A1"
                  className="w-full bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className={`w-full text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                    editingItemId
                      ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/10"
                      : "bg-red-700 hover:bg-red-600 shadow-red-750/10"
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Edit2 size={13} /> Guardar Cambios en Componente
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Añadir Componente al Almacén
                    </>
                  )}
                </button>

                {editingItemId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 hover:text-slate-900 font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center block shadow-2xs"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>
            </form>

            {/* INVENTORY TABLE LIST */}
            <div className="lg:col-span-8 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  Catálogo de Hardware Registrado ({items.length})
                </label>
                <button
                  type="button"
                  onClick={onOpenComponentTypeManager}
                  className="text-[9px] font-extrabold font-mono uppercase bg-red-50 hover:bg-red-100 border border-red-250 text-red-750 hover:text-red-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  ⚙️ Gestionar Clasificaciones
                </button>
              </div>

              {items.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
                  <Box className="text-slate-300 mb-2.5" size={32} />
                  <p className="text-slate-400 text-xs italic font-semibold">
                    No hay inventario registrado.
                  </p>
                  <p className="text-slate-450 text-[10px] font-medium max-w-[280px] mt-1 leading-normal">
                    Registra CPU, Motherboards, Almacenamientos, etc. para armar tus computadores desde la ficha del equipo.
                  </p>
                </div>
              ) : (() => {
                const filteredItems = items.filter((item) => {
                  if (selectedClassFilter !== "all" && item.type !== selectedClassFilter) {
                    return false;
                  }

                  if (!searchTerm.trim()) return true;

                  const searchLower = searchTerm.toLowerCase();

                  // 1. Search by component name
                  const matchesName = item.name.toLowerCase().includes(searchLower);

                  // 2. Search by component type / category
                  const { label: categoryName } = getIconAndLabel(item.type);
                  const matchesCategory = categoryName.toLowerCase().includes(searchLower);

                  // 3. Search by assigned person
                  const assignments = getAssignments(item.id);
                  const matchesAssignedPerson = assignments.some((as) =>
                    as.user.toLowerCase().includes(searchLower)
                  );

                  return matchesName || matchesCategory || matchesAssignedPerson;
                });

                return (
                  <>
                    {/* Buscador / Filtro con Clasificación */}
                    <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Search size={14} />
                        </div>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar por nombre, clasificación o quien lo tiene asignado..."
                          className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-red-500 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all outline-none shadow-3xs"
                        />
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="w-full sm:w-56">
                        <select
                          value={selectedClassFilter}
                          onChange={(e) => setSelectedClassFilter(e.target.value)}
                          className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-700 transition-all outline-none cursor-pointer shadow-3xs"
                        >
                          <option value="all">📁 Todas las Clasificaciones</option>
                          {componentTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.icon} {ct.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {filteredItems.length === 0 ? (
                      <div className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-slate-50/20 min-h-[220px]">
                        <Search className="text-slate-300 mb-2.5 animate-pulse" size={28} />
                        <p className="text-slate-450 text-xs italic font-semibold">
                          No se encontraron componentes que coincidan con la búsqueda.
                        </p>
                        <p className="text-slate-400 text-[10px] font-medium max-w-[320px] mt-1 leading-normal">
                          Intenta buscando por nombre de modelo, clasificación, o el nombre de la persona responsable asignada.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white max-h-[460px] overflow-y-auto">
                        <table className="w-full text-slate-800 text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-widest font-mono">
                              <th className="py-3 px-4">Componente</th>
                              <th className="py-3 px-4">Clasificación</th>
                              <th className="py-3 px-4">S/N - Detalles</th>
                              <th className="py-3 px-4 text-center">Estado (Libres / Total)</th>
                              <th className="py-3 px-4 text-right">Controles</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-medium">
                            {filteredItems.map((item) => {
                              const assigned = getActiveAssignmentsCount(item.id, database);
                              const free = Math.max(0, item.quantity - assigned);
                              const isStockOut = free === 0;
                              const { icon, label } = getIconAndLabel(item.type, 12);

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3.5 px-4 font-bold text-slate-800">
                                    <div>{item.name}</div>
                                    {item.notes && (
                                      <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-sans italic max-w-xs truncate">
                                        Nota: {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="flex items-center gap-1.5 text-[11px] text-slate-650 font-bold capitalize font-mono bg-slate-100 px-2 py-1/5 rounded-lg w-max shadow-2xs border border-slate-150/50">
                                      {icon}
                                      {label}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                                    {item.serial || <span className="text-slate-350">-</span>}
                                  </td>
                                  <td 
                                    className="py-3.5 px-4 text-center relative"
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                  >
                                    <div className="flex flex-col items-center justify-center gap-1 cursor-help">
                                      <div className="flex items-center gap-1 font-mono text-xs font-black">
                                        <span className={isStockOut ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded" : "text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"}>
                                          {free} libres
                                        </span>
                                        <span className="text-slate-400">/</span>
                                        <span className="text-slate-700">{item.quantity}</span>
                                      </div>
                                      <div className="text-[9px] text-slate-400 font-bold font-mono">
                                        {assigned} en equipos
                                      </div>
                                    </div>
                                    {hoveredItemId === item.id && (
                                      <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-xl shadow-xl z-50 p-3 text-left border border-slate-700 animate-in fade-in duration-200">
                                        <div className="font-extrabold text-red-400 uppercase tracking-widest text-[9px] mb-1.5 border-b border-slate-800 pb-1 flex items-center gap-1">
                                          <Monitor size={10} /> Asignaciones en Equipos ({assigned})
                                        </div>
                                        {assigned === 0 ? (
                                          <div className="text-slate-400 text-[10px]">Este componente no está asignado a ningún equipo en uso actualmente.</div>
                                        ) : (
                                          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                                            {getAssignments(item.id).map((as, idx) => (
                                              <li key={idx} className="border-b border-slate-800/60 pb-1.5 last:border-0 last:pb-0">
                                                <div className="text-slate-100 font-bold text-[11px] leading-tight">{as.name}</div>
                                                <div className="text-slate-400 text-[9px] font-mono leading-none mt-0.5">Asignado a: <span className="text-slate-300 font-sans font-semibold text-[10px]">{as.user}</span></div>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 pointer-events-none"></div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Stock increment/decrement */}
                                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (item.quantity > assigned) {
                                              onUpdateQuantity(item.id, -1);
                                            } else {
                                              alert("No puedes reducir el stock por debajo de la cantidad de componentes que ya están asignados a equipos.");
                                            }
                                          }}
                                          className="w-6 h-6 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-black cursor-pointer transition-colors"
                                          title="Restar stock"
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onUpdateQuantity(item.id, 1)}
                                          className="w-6 h-6 hover:bg-slate-200 border-l border-slate-200 flex items-center justify-center text-slate-600 font-black cursor-pointer transition-colors"
                                          title="Sumar stock"
                                        >
                                          +
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(item)}
                                        className="text-amber-600 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                        title="Editar propiedades del componente"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (free <= 0) {
                                            alert("No hay stock libre disponible para dar de baja. Primero desvincula el componente de los equipos activos.");
                                            return;
                                          }
                                          setDecommissioningItem(item);
                                          setDecommissionQty(1);
                                          setDecommissionReason("Falla técnica irreparable");
                                        }}
                                        className="text-amber-700 hover:text-amber-800 p-1.5 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                        title="Dar de baja unidades / Enviar a equipos dados de baja"
                                      >
                                        <ShieldAlert size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (assigned > 0) {
                                            alert("No puedes eliminar este componente de inventario porque está siendo utilizado en uno o más equipos. Primero desvincúlalo de los equipos.");
                                            return;
                                          }
                                          onDeleteItem(item.id);
                                        }}
                                        className="text-rose-500/70 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar registro"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          </div>

        </div>
      )}

      {decommissioningItem && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans text-slate-900 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center border border-amber-100">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Enviar a Equipos Dados de Baja</h3>
                <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest mt-0.5">Componente: {decommissioningItem.name}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  Cantidad a dar de baja (Sólamente se puede dar de baja stock libre)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={decommissioningItem.quantity - getActiveAssignmentsCount(decommissioningItem.id, database)}
                    value={decommissionQty}
                    onChange={(e) => setDecommissionQty(Math.min(
                      Math.max(1, Number(e.target.value) || 1),
                      decommissioningItem.quantity - getActiveAssignmentsCount(decommissioningItem.id, database)
                    ))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-mono font-bold"
                  />
                  <span className="text-[10px] font-black text-slate-400 font-mono shrink-0">
                    de {decommissioningItem.quantity - getActiveAssignmentsCount(decommissioningItem.id, database)} libres
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Motivo de la baja / Retiro de servicio</label>
                <select
                  value={decommissionReason}
                  onChange={(e) => setDecommissionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium cursor-pointer"
                >
                  <option value="Falla técnica irreparable">Falla técnica irreparable / Quemado</option>
                  <option value="Obsolescencia tecnológica">Obsolescencia tecnológica / Antiguo</option>
                  <option value="Daño físico / Fracturado">Daño físico / Rotura o Fractura</option>
                  <option value="Hurto / Pérdida física">Hurto / Pérdida física</option>
                  <option value="Reemplazo preventivo">Reemplazo preventivo / Actualización</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Detalles / Explicación del motivo</label>
                <textarea
                  value={decommissionCustomNotes}
                  onChange={(e) => setDecommissionCustomNotes(e.target.value)}
                  placeholder="Detalla aquí el motivo específico (ej. Rayas graves, disco quemado, pantalla rota, etc.)"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium h-20 resize-none placeholder-slate-400"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDecommissioningItem(null);
                  setDecommissionQty(1);
                  setDecommissionCustomNotes("");
                }}
                className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center font-mono"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalNotes = decommissionCustomNotes.trim();
                  const fullReason = finalNotes ? `${decommissionReason} — ${finalNotes}` : decommissionReason;
                  onDecommissionItem(decommissioningItem.id, decommissionQty, fullReason);
                  setDecommissioningItem(null);
                  setDecommissionQty(1);
                  setDecommissionCustomNotes("");
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center font-mono shadow-md"
              >
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCategoryInfo && (() => {
        const cat = componentTypes.find((c) => c.id === selectedCategoryInfo);
        const { icon, label } = getIconAndLabel(selectedCategoryInfo, 20);
        const userList = getCategoryUserInfo(selectedCategoryInfo);
        
        return (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans text-slate-900 animate-fade-in">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[85vh] animate-scale-in">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-50 text-red-700 rounded-xl flex items-center justify-center border border-red-100 shadow-sm">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Asignaciones de {label}</h3>
                    <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest mt-0.5">
                      Detalle de equipos y personas que tienen este tipo de dispositivo ({userList.length})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryInfo(null)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Data Content */}
              <div className="flex-1 overflow-y-auto pr-1 min-h-[200px]">
                {userList.length === 0 ? (
                  <div className="text-center py-12 text-slate-450 text-xs italic font-semibold bg-slate-50/50 rounded-2.5xl border border-slate-100 flex flex-col items-center justify-center gap-3">
                    <Box size={24} className="text-slate-350 animate-pulse" />
                    No hay asignaciones cargadas para esta categoría de dispositivo en ningún puesto de oficina.
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="py-3 px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Puesto / Equipo</th>
                          <th className="py-3 px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Responsable</th>
                          <th className="py-3 px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Ranura / Slot</th>
                          <th className="py-3 px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Dispositivo Asignado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userList.map((ul, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="text-xs font-bold text-slate-800 block leading-tight">
                                {ul.workstationLabel}
                              </span>
                              <span className="text-[9px] font-mono font-semibold text-slate-400">
                                ID: {ul.workstationId}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-extrabold text-slate-700 bg-slate-100/70 border border-slate-200/40 px-2 py-0.5 rounded-lg">
                                {ul.employee}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold text-red-650/80 font-mono tracking-tight bg-red-50/50 border border-red-100/30 px-1.5 py-0.5 rounded">
                                {ul.slotName}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-semibold text-slate-900 font-sans block leading-tight">
                                {ul.assignedDeviceName}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-5 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryInfo(null)}
                  className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-red-700/10 hover:shadow-red-650/15"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
    </div>
  );
};
