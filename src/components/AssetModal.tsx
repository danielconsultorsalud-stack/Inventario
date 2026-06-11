import React, { useState, useEffect } from "react";
import { X, Plus, Package, Edit, Settings, ChevronDown, ChevronUp, Trash2, ShieldAlert } from "lucide-react";
import { Area, AssetData, License, Database, InventoryItem, ComponentType } from "../types";

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  puestoId: string;
  puestoLabel: string;
  assetData: AssetData | undefined;
  areas: Area[];
  licenses: License[];
  database: Database;
  inventoryItems: InventoryItem[];
  componentTypes: ComponentType[];
  onSave: (puestoId: string, data: AssetData) => void;
  onOpenAreaManager: () => void;
  decommissionedItems: any[];
  onDecommissionItem: (itemId: string, quantity: number, reason: string, workstationName?: string) => void;
}

const isComponentKey = (key: string, componentTypes: ComponentType[] = []): boolean => {
  const standardKeys = [
    "board", "procesador", "ram1", "ram2", "ram3", "ram4",
    "alm1", "alm2", "alm3", "alm4", "video", "wifi", "mouse", "teclado",
    "camara", "auriculares", "mon1", "mon2", "otros"
  ];
  if (standardKeys.includes(key)) return true;
  return componentTypes.some((t) => t.id === key);
};

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  puestoId,
  puestoLabel,
  assetData,
  areas,
  licenses,
  database,
  inventoryItems,
  componentTypes,
  onSave,
  onOpenAreaManager,
  decommissionedItems = [],
  onDecommissionItem,
}) => {
  const [formData, setFormData] = useState<AssetData>({});
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [manualModes, setManualModes] = useState<Record<string, boolean>>({});
  const [isLicenseDropdownOpen, setIsLicenseDropdownOpen] = useState(false);

  const getLicenseDropdownLabel = () => {
    const selectedIds = formData.licencia_ids || [];
    if (selectedIds.length === 0) return "Sin Licencias Vinculadas";
    if (selectedIds.length === 1) {
      const lic = licenses.find(l => l.id === selectedIds[0]);
      return `Licencia: ${lic ? lic.name : selectedIds[0]}`;
    }
    return `${selectedIds.length} Licencias Seleccionadas`;
  };

  // Reset form and initialize manual modes when opened or asset data changes
  useEffect(() => {
    if (isOpen) {
      const initialLicIds = assetData?.licencia_ids || (assetData?.licencia_id ? [assetData.licencia_id] : []);
      setFormData({
        ...(assetData || {}),
        licencia_ids: initialLicIds,
        licencia_id: initialLicIds[0] || "",
      });
      setLicenseError(null);
      setIsLicenseDropdownOpen(false);

      const initialManual: Record<string, boolean> = {};
      const componentFields = [
        "board", "video", "procesador", "ram1", "ram2", "ram3", "ram4",
        "alm1", "alm2", "alm3", "alm4", "mon1", "mon2", "wifi", "mouse", "teclado",
        "camara", "auriculares", "otros",
        ...(componentTypes || []).map((t) => t.id)
      ];

      componentFields.forEach((field) => {
        const val = assetData?.[field];
        if (val) {
          // If the assigned value exists as an ID in inventory, we use Inventory Mode. Otherwise, Manual Mode.
          const exists = inventoryItems.some((item) => item.id === val);
          initialManual[field] = !exists;
        } else {
          // By default, if empty, let's offer Inventory mode
          initialManual[field] = false;
        }
      });
      setManualModes(initialManual);
    }
  }, [isOpen, assetData, inventoryItems, componentTypes]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClearAll = () => {
    if (window.confirm("¿Estás seguro de que deseas vaciar y limpiar todos los campos y componentes seleccionados para este puesto? (Ningún cambio se guardará de forma definitiva hasta que hagas clic en Guardar)")) {
      const clearedData: AssetData = {
        nombre_equipo: "",
        asignado_a: "",
        area_select: "",
        licencia_ids: [],
        licencia_id: "",
        comentarios: "",
      };
      
      const componentFields = [
        "board", "video", "procesador", "ram1", "ram2", "ram3", "ram4",
        "alm1", "alm2", "alm3", "alm4", "mon1", "mon2", "wifi", "mouse", "teclado",
        "camara", "auriculares", "otros",
        ...(componentTypes || []).map((t) => t.id)
      ];
      
      componentFields.forEach((field) => {
        clearedData[field] = "";
      });
      
      setFormData(clearedData);
      setLicenseError(null);
      
      const clearedManual: Record<string, boolean> = {};
      componentFields.forEach((field) => {
        clearedManual[field] = false;
      });
      setManualModes(clearedManual);
    }
  };

  const handleToggleLicense = (licId: string) => {
    const currentIds = formData.licencia_ids || (formData.licencia_id ? [formData.licencia_id] : []);
    let newIds: string[] = [];
    
    if (currentIds.includes(licId)) {
      // Uncheck
      newIds = currentIds.filter(id => id !== licId);
      setLicenseError(null);
    } else {
      // Check limit
      const lic = licenses.find((l) => l.id === licId);
      if (lic) {
        const otherUsage = (Object.entries(database) as [string, AssetData][]).filter(([id, asset]) => {
          if (id === puestoId || !asset) return false;
          const ids = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
          return ids.includes(licId);
        }).length;

        if (otherUsage >= lic.limit) {
          setLicenseError(`Límite Excedido/Advertencia: La licencia "${lic.name}" ya está asignada a ${otherUsage}/${lic.limit} equipos.`);
        } else {
          setLicenseError(null);
        }
      }
      newIds = [...currentIds, licId];
    }
    
    setFormData((prev) => ({
      ...prev,
      licencia_ids: newIds,
      licencia_id: newIds[0] || "",
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Final guard checks for license limit allocation of ALL selected licenses
    const selectedIds = formData.licencia_ids || (formData.licencia_id ? [formData.licencia_id] : []);
    for (const licId of selectedIds) {
      const lic = licenses.find((l) => l.id === licId);
      if (lic) {
        const otherUsage = (Object.entries(database) as [string, AssetData][]).filter(([id, asset]) => {
          if (id === puestoId || !asset) return false;
          const ids = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
          return ids.includes(licId);
        }).length;

        if (otherUsage >= lic.limit) {
          alert(`No es posible guardar: Límite excedido para la licencia "${lic.name}" (${lic.limit} equipos máx).`);
          return;
        }
      }
    }

    onSave(puestoId, formData);
  };

  const handleDecommissionFromPuesto = (fieldKey: string, itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;
    
    const reasonValue = window.prompt(
      `Estás dando de baja "${item.name}" del puesto "${puestoLabel}".\n\nPor favor, escribe el motivo de la baja:`,
      "Falla técnica irreparable"
    );
    
    if (reasonValue === null) {
      // User cancelled
      return;
    }
    
    const qty = 1;
    onDecommissionItem(itemId, qty, reasonValue || "Falla técnica irreparable", puestoLabel);
    
    handleChange(fieldKey, "");
  };

  // Helper to render Hardware Selector (with support for both inventory stock allocation and manual input override)
  const renderHardwareField = (
    fieldKey: string,
    label: string,
    itemType: InventoryItem["type"],
    placeholder: string
  ) => {
    const isManual = manualModes[fieldKey] === true;
    const matchingItems = inventoryItems.filter((item) => item.type === itemType);
    const currentValue = formData[fieldKey] || "";
    const isAssignedToInventory = !isManual && currentValue && inventoryItems.some((item) => item.id === currentValue);

    // Compute dynamic stock availability
    const getAvailability = (item: InventoryItem) => {
      // 1. Count allocations in other desks
      let elsewhere = 0;
      Object.entries(database).forEach(([id, desk]) => {
        if (id === puestoId) return;
        if (!desk) return;
        Object.entries(desk).forEach(([k, v]) => {
          if (isComponentKey(k, componentTypes) && v === item.id) {
            elsewhere++;
          }
        });
      });

      // 2. Count allocations in the current desk's form draft (excluding this exact fieldKey)
      let currentDraftOthers = 0;
      Object.entries(formData).forEach(([k, v]) => {
        if (k !== fieldKey && isComponentKey(k, componentTypes) && v === item.id) {
          currentDraftOthers++;
        }
      });

      const totalAssigned = elsewhere + currentDraftOthers;
      const free = Math.max(0, item.quantity - totalAssigned);
      return { free, total: item.quantity };
    };

    const inputClassName =
      "bg-slate-50 border border-slate-200 text-slate-800 text-xs w-full px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all font-medium placeholder-slate-450 shadow-2xs";

    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center gap-1">
          <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-widest font-mono truncate">
            {label}
          </label>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setManualModes((prev) => ({
                  ...prev,
                  [fieldKey]: !prev[fieldKey],
                }));
                // Clear on toggle to avoid lingering IDs in manual mode or text in select
                handleChange(fieldKey, "");
              }}
              className="text-[8px] font-black font-mono uppercase bg-slate-50 hover:bg-slate-100 border border-slate-200 text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1"
            >
              {isManual ? (
                <>
                  <Package size={9} /> Usar Inventario
                </>
              ) : (
                <>
                  <Edit size={9} /> Entrada Manual
                </>
              )}
            </button>

            {isAssignedToInventory && (
              <button
                type="button"
                onClick={() => handleDecommissionFromPuesto(fieldKey, currentValue)}
                className="text-[8px] font-black font-mono uppercase bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1"
                title="Dar de baja este componente"
              >
                <ShieldAlert size={9} /> Dar de Baja
              </button>
            )}
          </div>
        </div>

        {isManual ? (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(fieldKey, e.target.value)}
            className={inputClassName}
            placeholder={placeholder}
          />
        ) : (
          <select
            value={currentValue}
            onChange={(e) => handleChange(fieldKey, e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium cursor-pointer"
          >
            <option value="">-- Sin Asignar / Libre en Stock --</option>
            {matchingItems.map((item) => {
              const { free, total } = getAvailability(item);
              const isSelected = currentValue === item.id;
              const isFull = free <= 0 && !isSelected;

              return (
                <option
                  key={item.id}
                  value={item.id}
                  disabled={isFull}
                  className={isFull ? "text-slate-400 font-normal line-through animate-pulse" : "text-slate-800 font-semibold"}
                >
                  {item.name} {item.serial ? `(S/N: ${item.serial})` : ""} [{free}/{total} libres] {isFull ? "⚠️ REGISTRO SIN STOCK" : ""}
                </option>
              );
            })}
          </select>
        )}
      </div>
    );
  };

  const decommissionedInThisPuesto = decommissionedItems.filter((dec) => dec.originalWorkstation === puestoLabel);

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-[80] p-4 font-sans text-slate-950 transition-all">
      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl animate-fade-in max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Ajustes del Equipo — <span className="text-red-700 font-normal">{puestoLabel}</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 font-mono">
              Ficha Técnica de Equipamiento Basada en Almacén e Inventario General
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-200/60 flex items-center justify-center transition-all cursor-pointer text-slate-400 hover:text-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="p-6 md:p-8 overflow-y-auto max-h-[calc(90vh-210px)] space-y-6">
            
            {/* COMPONENTES DADOS DE BAJA RECIENTEMENTE EN ESTE PUESTO */}
            {decommissionedInThisPuesto.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 pr-6 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-[11px] uppercase tracking-wider">
                  <ShieldAlert size={14} className="text-amber-700 animate-pulse" />
                  <span>Componentes de este puesto dados de baja / extraídos históricamente:</span>
                  <span className="ml-auto font-mono text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                    {decommissionedInThisPuesto.length} Retiros
                  </span>
                </div>
                
                <div className="divide-y divide-amber-150/40 max-h-36 overflow-y-auto pr-1">
                  {decommissionedInThisPuesto.map((dec) => (
                    <div key={dec.id} className="py-2.5 flex items-center justify-between text-xs text-slate-700 last:pb-0">
                      <div>
                        <span className="font-extrabold text-slate-900 text-[12px]">{dec.name}</span>
                        {dec.serial && (
                          <span className="font-mono text-[10px] text-slate-400 ml-2 font-bold select-all bg-slate-100 px-1 py-0.5 rounded border border-slate-200/60">
                            S/N: {dec.serial}
                          </span>
                        )}
                        <span className="text-slate-500 block text-[10px] mt-0.5 font-medium leading-relaxed">
                          Motivo de baja: <strong className="text-red-750 font-bold">{dec.reason}</strong>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-100/50 px-2 py-1 rounded-lg">
                          Cant: {dec.quantity} ud.
                        </span>
                        <span className="text-[9px] block text-slate-450 font-mono mt-1 font-bold">
                          {new Date(dec.timestamp).toLocaleDateString()} {new Date(dec.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* BLOQUE 1: Identificación y Placa */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest font-mono">
                    Identificación y Base
                  </h4>
                </div>
                
                {/* Area Select */}
                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1.5 block font-mono">
                    Área / Departamento
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.area_select || ""}
                      onChange={(e) => handleChange("area_select", e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium cursor-pointer"
                    >
                      <option value="">-- Sin Área --</option>
                      {areas.map((area, i) => (
                        <option key={i} value={area.name}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={onOpenAreaManager}
                      className="bg-red-50 hover:bg-red-100 text-red-700 w-10 h-10 rounded-xl border border-red-250/55 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
                      title="Configurar áreas"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* License Select (Multiple Dropdown) */}
                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider block font-mono">
                    Licencias Vinculadas
                  </label>
                  
                  {/* Dropdown trigger button */}
                  <button
                    type="button"
                    onClick={() => setIsLicenseDropdownOpen(!isLicenseDropdownOpen)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs px-3.5 py-3 rounded-xl outline-none transition-all font-medium flex items-center justify-between cursor-pointer shadow-2xs"
                  >
                    <span className="truncate text-[11px] font-semibold text-slate-750">
                      {getLicenseDropdownLabel()}
                    </span>
                    {isLicenseDropdownOpen ? (
                      <ChevronUp size={14} className="text-slate-500 shrink-0 select-none ml-2" />
                    ) : (
                      <ChevronDown size={14} className="text-slate-500 shrink-0 select-none ml-2" />
                    )}
                  </button>

                  {/* Dropdown collapsible list container */}
                  {isLicenseDropdownOpen && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-3 max-h-48 overflow-y-auto space-y-2 scrollbar-thin shadow-inner animate-in slide-in-from-top-1 duration-150">
                      {licenses.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center font-medium py-3">
                          No hay licencias creadas.
                        </p>
                      ) : (
                        licenses.map((lic) => {
                          const otherUsage = (Object.entries(database) as [string, AssetData][]).filter(([id, asset]) => {
                            if (id === puestoId || !asset) return false;
                            const ids = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
                            return ids.includes(lic.id);
                          }).length;
                          
                          const isSelected = formData.licencia_ids?.includes(lic.id) || false;
                          const isFull = otherUsage >= lic.limit;
                          
                          return (
                            <div
                              key={lic.id}
                              onClick={() => handleToggleLicense(lic.id)}
                              className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "bg-red-50/50 border-red-200 text-slate-900 font-bold"
                                  : "bg-slate-50/40 border-slate-100 hover:border-slate-200 text-slate-755"
                              }`}
                            >
                               <div className="flex items-center gap-2.5">
                                 <input
                                   type="checkbox"
                                   checked={isSelected}
                                   onChange={() => {}} // Controlled click on outer parent div
                                   className="w-3.5 h-3.5 rounded text-red-650 border-slate-300 focus:ring-red-500/20 cursor-pointer"
                                 />
                                 <span className="text-[11.5px] font-semibold tracking-tight leading-tight">
                                   {lic.name}
                                 </span>
                               </div>
                               
                               <div className="flex items-center gap-2 font-mono shrink-0">
                                 <span className="text-[9px] font-bold text-slate-400">
                                   {otherUsage}/{lic.limit}
                                 </span>
                                 
                                 {isFull && !isSelected && (
                                   <span className="bg-rose-50 border border-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                     Completa
                                   </span>
                                 )}
                                 
                                 {isSelected && (
                                   <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                     Activa
                                   </span>
                                 )}
                               </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  
                  {licenseError && (
                    <p className="text-[9px] text-rose-600 font-extrabold bg-rose-50 border border-rose-100 p-2 rounded-xl font-mono leading-relaxed">
                      ⚠️ {licenseError}
                    </p>
                  )}
                </div>

                {/* Pure text input fields */}
                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1.5 block font-mono">
                    Nombre del Equipo
                  </label>
                  <input
                    type="text"
                    value={formData.nombre_equipo || ""}
                    onChange={(e) => handleChange("nombre_equipo", e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs w-full px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                    placeholder="Ej. DESKTOP-CONTABILIDAD"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1.5 block font-mono">
                    Asignado a (Persona)
                  </label>
                  <input
                    type="text"
                    value={formData.asignado_a || ""}
                    onChange={(e) => handleChange("asignado_a", e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs w-full px-3 py-2.5 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs"
                    placeholder="Nombre del Colaborador"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider mb-1.5 block font-mono">
                    Comentarios / Observaciones
                  </label>
                  <textarea
                    value={formData.comentarios || ""}
                    onChange={(e) => handleChange("comentarios", e.target.value)}
                    rows={3}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs w-full px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-red-500 transition-all font-medium placeholder-slate-400 shadow-2xs resize-none"
                    placeholder="Escribe comentarios, observaciones o detalles específicos de este puesto..."
                  />
                </div>

                {/* Hardware components of Block 1 */}
                {renderHardwareField("board", "Tarjeta Madre (Board)", "board", "Ej. ASUS Prime B450")}
                {renderHardwareField("video", "Tarjeta Gráfica (GPU)", "video", "Ej. NVIDIA GTX 1660")}
              </div>

              {/* BLOQUE 2: Procesador y RAM */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest font-mono">
                    Procesador y Memoria
                  </h4>
                </div>
                {renderHardwareField("procesador", "Procesador (CPU)", "procesador", "Ej. Intel Core i7 12th Gen")}
                {renderHardwareField("ram1", "RAM - Módulo 1", "ram", "Ej. DDR4 8GB 3200Mhz")}
                {renderHardwareField("ram2", "RAM - Módulo 2", "ram", "Módulo opcional")}
                {renderHardwareField("ram3", "RAM - Módulo 3", "ram", "Módulo opcional")}
                {renderHardwareField("ram4", "RAM - Módulo 4", "ram", "Módulo opcional")}
              </div>

              {/* BLOQUE 3: Almacenamiento y Pantallas */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest font-mono">
                    Almacenamiento y Video
                  </h4>
                </div>
                {renderHardwareField("alm1", "Almacenamiento Principal (SSD/HDD)", "almacenamiento", "Ej. SSD NVMe 512GB")}
                {renderHardwareField("alm2", "Almacenamiento Secundario", "almacenamiento", "Unidad opcional")}
                {renderHardwareField("alm3", "Almacenamiento Terciario", "almacenamiento", "Unidad opcional")}
                {renderHardwareField("alm4", "Almacenamiento Cuaternario", "almacenamiento", "Unidad opcional")}
                {renderHardwareField("mon1", "Monitor Principal", "monitor", "Ej. Monitor LG IPS 24''")}
                {renderHardwareField("mon2", "Monitor Secundario", "monitor", "Monitor auxiliar opcional")}
              </div>

              {/* BLOQUE 4: Conectividad y Periféricos */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest font-mono">
                    Red y Accesorios
                  </h4>
                </div>
                {renderHardwareField("wifi", "Adaptador Red / WiFi", "wifi", "Ej. Intel WiFi 6 AX200")}
                {renderHardwareField("mouse", "Mouse (Ratón)", "mouse", "Ej. Logitech G305")}
                {renderHardwareField("teclado", "Teclado", "teclado", "Ej. Teclado Mecánico Redragon")}
                {renderHardwareField("camara", "Cámara Web", "camara", "Ej. Logitech C920 1080p")}
                {renderHardwareField("auriculares", "Auriculares / Diadema", "auriculares", "Ej. HyperX Cloud Core")}
              </div>

              {/* DYNAMIC ADDITIONAL CUSTOM COMPONENT FIELDS */}
              {componentTypes && componentTypes.filter(t => !["board", "video", "procesador", "ram", "almacenamiento", "monitor", "wifi", "mouse", "teclado", "camara", "auriculares"].includes(t.id)).length > 0 && (
                <div className="pt-6 border-t border-slate-100 col-span-full space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      📦 Componentes Adicionales Personalizados
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {componentTypes
                      .filter(t => !["board", "video", "procesador", "ram", "almacenamiento", "monitor", "wifi", "mouse", "teclado", "camara", "auriculares"].includes(t.id))
                      .map((ct) => renderHardwareField(ct.id, `${ct.icon} ${ct.name}`, ct.id, `Ej. ingresar ${ct.name}...`))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ACTIONS FOOTER */}
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full sm:w-auto bg-amber-50 hover:bg-amber-100 border border-amber-250/70 text-amber-850 font-extrabold px-5 py-3.5 rounded-2xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-xs text-center flex items-center justify-center gap-1.5 shrink-0"
              title="Restablecer y vaciar todos los campos de este puesto"
            >
              <Trash2 size={13} className="shrink-0 text-amber-700" />
              Limpiar Puesto
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 hover:text-slate-900 font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-sm text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#a40000] hover:bg-[#b80000] text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-wider shadow-lg shadow-red-900/10 hover:shadow-red-900/15 transition-all cursor-pointer text-center"
            >
              Guardar Configuración de Activo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
