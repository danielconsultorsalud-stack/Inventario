import React, { useState } from "react";
import { X, CheckCircle, Package, User, Calendar, FileText, ArrowRight, Printer, AlertTriangle, Building2, Tag, ShieldCheck } from "lucide-react";
import { InventoryItem, ComponentType, Area, Database, AssetData, EquipmentLoan } from "../types";

interface EquipmentLoanPublicModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
  componentTypes: ComponentType[];
  areas: Area[];
  database: Database;
  onSubmitLoan: (loan: Omit<EquipmentLoan, "id" | "checkoutDate" | "status">) => Promise<EquipmentLoan | null>;
}

export const EquipmentLoanPublicModal: React.FC<EquipmentLoanPublicModalProps> = ({
  isOpen,
  onClose,
  inventoryItems,
  componentTypes,
  areas,
  database,
  onSubmitLoan,
}) => {
  // Mode selection: from inventory or custom
  const [sourceType, setSourceType] = useState<"inventory" | "custom">("inventory");
  
  // Form fields
  const [requesterName, setRequesterName] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemType, setCustomItemType] = useState<string>(() => componentTypes[0]?.id || "otros");
  const [quantity, setQuantity] = useState<number>(1);
  const [serial, setSerial] = useState("");
  const [purpose, setPurpose] = useState<string>("Trabajo Remoto / Home Office");
  const [destination, setDestination] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedLoan, setCompletedLoan] = useState<EquipmentLoan | null>(null);

  if (!isOpen) return null;

  // Extract list of known employees from workstations database
  const knownEmployees: { name: string; area?: string }[] = [];
  const nameSet = new Set<string>();

  Object.values(database).forEach((rawDesk) => {
    const desk = rawDesk as AssetData;
    if (desk && desk.asignado_a && desk.asignado_a.trim()) {
      const trimmed = desk.asignado_a.trim();
      if (!nameSet.has(trimmed.toLowerCase())) {
        nameSet.add(trimmed.toLowerCase());
        knownEmployees.push({ name: trimmed, area: desk.area_select });
      }
    }
  });

  // Available inventory items (quantity > 0)
  const availableInventoryItems = inventoryItems.filter((i) => i.quantity > 0);
  const selectedInventoryItem = inventoryItems.find((i) => i.id === selectedInventoryItemId);

  const handleSelectInventoryItem = (itemId: string) => {
    setSelectedInventoryItemId(itemId);
    const item = inventoryItems.find((i) => i.id === itemId);
    if (item) {
      setCustomItemName(item.name);
      setCustomItemType(item.type);
      if (item.serial) setSerial(item.serial);
      if (quantity > item.quantity) {
        setQuantity(1);
      }
    }
  };

  const handleSelectEmployee = (name: string) => {
    setRequesterName(name);
    const match = knownEmployees.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (match && match.area) {
      setSelectedArea(match.area);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!requesterName.trim()) {
      setErrorMessage("Por favor ingresa el nombre de la persona a quien se asigna/presta el equipo.");
      return;
    }

    let finalItemName = "";
    let finalItemType = "";
    let finalInvId: string | undefined = undefined;

    if (sourceType === "inventory") {
      if (!selectedInventoryItemId || !selectedInventoryItem) {
        setErrorMessage("Por favor selecciona un equipo del inventario disponible.");
        return;
      }
      if (quantity <= 0 || quantity > selectedInventoryItem.quantity) {
        setErrorMessage(`La cantidad debe ser entre 1 y el stock disponible (${selectedInventoryItem.quantity}).`);
        return;
      }
      finalItemName = selectedInventoryItem.name;
      finalItemType = selectedInventoryItem.type;
      finalInvId = selectedInventoryItem.id;
    } else {
      if (!customItemName.trim()) {
        setErrorMessage("Por favor ingresa el nombre o descripción del equipo.");
        return;
      }
      if (quantity <= 0) {
        setErrorMessage("La cantidad debe ser al menos 1.");
        return;
      }
      finalItemName = customItemName.trim();
      finalItemType = customItemType;
    }

    try {
      setIsSubmitting(true);
      const created = await onSubmitLoan({
        requesterName: requesterName.trim(),
        area: selectedArea || undefined,
        itemName: finalItemName,
        itemType: finalItemType,
        inventoryItemId: finalInvId,
        quantity: Number(quantity),
        serial: serial.trim() || undefined,
        purpose: purpose || "Salida de equipo autorizada",
        destination: destination.trim() || undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        notes: notes.trim() || undefined,
      });

      if (created) {
        setCompletedLoan(created);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocurrió un error al registrar la solicitud de salida.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleResetForm = () => {
    setCompletedLoan(null);
    setRequesterName("");
    setSelectedArea("");
    setSelectedInventoryItemId("");
    setCustomItemName("");
    setQuantity(1);
    setSerial("");
    setPurpose("Trabajo Remoto / Home Office");
    setDestination("");
    setExpectedReturnDate("");
    setNotes("");
    setErrorMessage("");
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4 font-sans text-slate-900 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col my-auto animate-scale-in">
        
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-red-800 via-red-700 to-red-650 text-white p-6 sm:p-7 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3.5 mb-1.5">
            <div className="w-11 h-11 bg-white/15 border border-white/20 rounded-2xl flex items-center justify-center text-white shadow-inner">
              <Package size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-200 font-mono block leading-none">
                Consultorsalud TI
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Solicitud de Salida de Equipo
              </h2>
            </div>
          </div>
          <p className="text-xs text-red-100/90 font-medium max-w-lg mt-2">
            Registra el préstamo o salida temporal de hardware, periféricos o accesorios para colaboradores.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto space-y-6">
          
          {completedLoan ? (
            /* Confirmation & Printable Voucher View */
            <div className="space-y-6 animate-fade-in" id="loan-receipt-printable">
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-4 text-emerald-950">
                <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-900">
                    ¡Salida de Equipo Registrada Correctamente!
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1 font-medium leading-relaxed">
                    El equipo ha sido asignado a <strong className="font-black text-emerald-950">{completedLoan.requesterName}</strong> y se ha descontado del inventario activo.
                  </p>
                </div>
              </div>

              {/* Receipt Ticket Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Comprobante de Salida</span>
                    <span className="text-sm font-black text-red-700">#{completedLoan.id.toUpperCase()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">Fecha de Salida</span>
                    <span className="font-bold text-slate-800">
                      {new Date(completedLoan.checkoutDate).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 border-b border-slate-200">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Colaborador / Asignado</span>
                    <span className="font-black text-slate-900 text-sm font-sans">{completedLoan.requesterName}</span>
                    {completedLoan.area && (
                      <span className="text-[11px] text-slate-500 font-sans block mt-0.5">{completedLoan.area}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Equipo / Dispositivo</span>
                    <span className="font-black text-slate-900 text-sm font-sans">
                      {completedLoan.quantity}x {completedLoan.itemName}
                    </span>
                    {completedLoan.serial && (
                      <span className="text-[11px] text-slate-600 block mt-0.5">S/N: {completedLoan.serial}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 border-b border-slate-200">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Motivo de Salida</span>
                    <span className="font-bold text-slate-800 font-sans">{completedLoan.purpose}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Estimada de Entrega</span>
                    <span className="font-bold text-slate-800">
                      {completedLoan.expectedReturnDate ? completedLoan.expectedReturnDate : "No especificada"}
                    </span>
                  </div>
                </div>

                {completedLoan.destination && (
                  <div className="py-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Destino / Ubicación</span>
                    <span className="text-slate-700 font-sans">{completedLoan.destination}</span>
                  </div>
                )}

                {completedLoan.notes && (
                  <div className="py-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Observaciones</span>
                    <span className="text-slate-600 italic font-sans">{completedLoan.notes}</span>
                  </div>
                )}

                {/* Signatures section for physical voucher printing */}
                <div className="pt-8 pb-4 grid grid-cols-2 gap-8 border-t border-slate-200/80">
                  <div className="border-t border-slate-400 text-center pt-2">
                    <span className="text-[10px] font-bold text-slate-600 block font-sans">Firma de Quien Recibe</span>
                    <span className="text-[9px] text-slate-400 block font-sans">C.C. ___________________</span>
                  </div>
                  <div className="border-t border-slate-400 text-center pt-2">
                    <span className="text-[10px] font-bold text-slate-600 block font-sans">Autorizado por TI</span>
                    <span className="text-[9px] text-slate-400 block font-sans">Consultorsalud</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer size={15} /> Imprimir / Guardar Acta
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-3 rounded-xl transition-all cursor-pointer"
                  >
                    Nueva Solicitud
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-red-700 hover:bg-red-650 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Entendido / Cerrar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Loan Request Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Section 1: Persona Asignada */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <User size={13} className="text-red-700" />
                  1. Persona Asignada / Solicitante *
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      required
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="Nombre y Apellidos..."
                      list="known-employees-list"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none"
                    />
                    <datalist id="known-employees-list">
                      {knownEmployees.map((emp, idx) => (
                        <option key={idx} value={emp.name}>
                          {emp.area ? `${emp.name} (${emp.area})` : emp.name}
                        </option>
                      ))}
                    </datalist>
                    {knownEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[9px] text-slate-400 font-medium">Sugeridos:</span>
                        {knownEmployees.slice(0, 4).map((emp, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectEmployee(emp.name)}
                            className="text-[9px] bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer"
                          >
                            {emp.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none"
                    >
                      <option value="">-- Seleccionar Área / Departamento --</option>
                      {areas.map((a, i) => (
                        <option key={i} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Origen y Selección del Equipo */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Package size={13} className="text-red-700" />
                    2. Selección de Equipo a Prestar / Sacar *
                  </label>
                  
                  {/* Switch between inventory stock and custom item */}
                  <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-extrabold font-mono">
                    <button
                      type="button"
                      onClick={() => setSourceType("inventory")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        sourceType === "inventory"
                          ? "bg-white text-red-700 shadow-xs font-black"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      📦 Inventario Stock ({availableInventoryItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceType("custom")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        sourceType === "custom"
                          ? "bg-white text-red-700 shadow-xs font-black"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      💻 Equipo Personalizado
                    </button>
                  </div>
                </div>

                {sourceType === "inventory" ? (
                  <div className="space-y-3">
                    {availableInventoryItems.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                        No hay artículos con stock positivo en el inventario. Puedes seleccionar "Equipo Personalizado" para registrar la salida manualmente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-200/80 rounded-2xl bg-slate-50/50">
                        {availableInventoryItems.map((item) => {
                          const isSelected = selectedInventoryItemId === item.id;
                          const cType = componentTypes.find((c) => c.id === item.type);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectInventoryItem(item.id)}
                              className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white border-red-500 ring-2 ring-red-500/20 shadow-xs"
                                  : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{cType?.icon || "📦"}</span>
                                <div>
                                  <div className="text-xs font-black text-slate-900">{item.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {cType?.name || item.type} {item.serial ? `• S/N: ${item.serial}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black font-mono px-2 py-0.5 rounded-md">
                                  {item.quantity} en stock
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedInventoryItem && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Cantidad a Sacar (Máx {selectedInventoryItem.quantity}) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={selectedInventoryItem.quantity}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(selectedInventoryItem.quantity, parseInt(e.target.value) || 1)))}
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            Serial / Placa (Opcional)
                          </label>
                          <input
                            type="text"
                            value={serial}
                            onChange={(e) => setSerial(e.target.value)}
                            placeholder="Número de serie..."
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                          Nombre / Modelo del Equipo *
                        </label>
                        <input
                          type="text"
                          required
                          value={customItemName}
                          onChange={(e) => setCustomItemName(e.target.value)}
                          placeholder="Ej: Portátil Dell Latitude 5420, Diadema Jabra..."
                          className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:border-red-500 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                          Categoría *
                        </label>
                        <select
                          value={customItemType}
                          onChange={(e) => setCustomItemType(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:border-red-500 transition-all outline-none"
                        >
                          {componentTypes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                          Cantidad *
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:border-red-500 transition-all outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                          Número de Serie / Placa
                        </label>
                        <input
                          type="text"
                          value={serial}
                          onChange={(e) => setSerial(e.target.value)}
                          placeholder="S/N..."
                          className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:border-red-500 transition-all outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Motivo, Fechas y Destino */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar size={13} className="text-red-700" />
                  3. Detalles de la Salida y Devolución
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Motivo de Salida *
                    </label>
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none"
                    >
                      <option value="Trabajo Remoto / Home Office">Trabajo Remoto / Home Office</option>
                      <option value="Reunión / Presentación Externa">Reunión / Presentación Externa</option>
                      <option value="Comisión de Servicios / Viaje">Comisión de Servicios / Viaje</option>
                      <option value="Mantenimiento / Reparación Externa">Mantenimiento / Reparación Externa</option>
                      <option value="Evento / Capacitación Institucional">Evento / Capacitación Institucional</option>
                      <option value="Préstamo Temporal entre Sedes">Préstamo Temporal entre Sedes</option>
                      <option value="Otro Motivo Autorizado">Otro Motivo Autorizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Fecha Estimada de Entrega / Devolución
                    </label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Destino / Ubicación de Uso (Opcional)
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ej: Domicilio / Sede Norte / Cliente..."
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Observaciones / Accesorios Adicionales
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Incluye cargador, estuche y cable HDMI..."
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-red-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-700 hover:bg-red-650 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-red-700/15 disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  {isSubmitting ? "Registrando..." : "Registrar Salida de Equipo"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
