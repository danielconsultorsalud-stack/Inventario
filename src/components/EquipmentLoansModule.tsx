import React, { useState } from "react";
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  Calendar,
  Layers,
  X,
  ArrowUpRight,
  ShieldCheck,
  Check
} from "lucide-react";
import { EquipmentLoan, InventoryItem, ComponentType } from "../types";

interface EquipmentLoansModuleProps {
  loans: EquipmentLoan[];
  inventoryItems: InventoryItem[];
  componentTypes: ComponentType[];
  onReturnLoan: (loanId: string, returnNotes?: string) => void;
  onDeleteLoan: (loanId: string) => void;
  onOpenNewLoanModal: () => void;
}

export const EquipmentLoansModule: React.FC<EquipmentLoansModuleProps> = ({
  loans,
  inventoryItems,
  componentTypes,
  onReturnLoan,
  onDeleteLoan,
  onOpenNewLoanModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "prestado" | "devuelto" | "vencido">("all");
  
  // Return modal state
  const [returningLoan, setReturningLoan] = useState<EquipmentLoan | null>(null);
  const [returnNotes, setReturnNotes] = useState("Equipo recibido y verificado en buen estado.");
  
  // Voucher modal state
  const [selectedVoucherLoan, setSelectedVoucherLoan] = useState<EquipmentLoan | null>(null);
  
  // Delete confirm state
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Counters
  const totalCount = loans.length;
  const activeLoans = loans.filter((l) => l.status === "prestado");
  const returnedLoans = loans.filter((l) => l.status === "devuelto");
  const overdueLoans = loans.filter(
    (l) => l.status === "prestado" && l.expectedReturnDate && l.expectedReturnDate < todayStr
  );

  // Filtered loans list
  const filteredLoans = loans.filter((loan) => {
    // Status filter
    if (statusFilter === "prestado" && loan.status !== "prestado") return false;
    if (statusFilter === "devuelto" && loan.status !== "devuelto") return false;
    if (statusFilter === "vencido") {
      if (loan.status !== "prestado") return false;
      if (!loan.expectedReturnDate || loan.expectedReturnDate >= todayStr) return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = loan.requesterName.toLowerCase().includes(term);
      const matchItem = loan.itemName.toLowerCase().includes(term);
      const matchSerial = loan.serial ? loan.serial.toLowerCase().includes(term) : false;
      const matchArea = loan.area ? loan.area.toLowerCase().includes(term) : false;
      const matchPurpose = loan.purpose.toLowerCase().includes(term);
      const matchId = loan.id.toLowerCase().includes(term);
      return matchName || matchItem || matchSerial || matchArea || matchPurpose || matchId;
    }

    return true;
  });

  const handleConfirmReturn = () => {
    if (!returningLoan) return;
    onReturnLoan(returningLoan.id, returnNotes.trim());
    setReturningLoan(null);
    setReturnNotes("Equipo recibido y verificado en buen estado.");
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center justify-center shadow-xs">
            <Package size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                Control de Salidas y Préstamos de Equipos
              </h2>
              {activeLoans.length > 0 && (
                <span className="bg-amber-100 text-amber-900 font-mono text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                  {activeLoans.length} en préstamo
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">
              Registro histórico de salidas de hardware a colaboradores y seguimiento de entregas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onOpenNewLoanModal}
            className="bg-red-700 hover:bg-red-650 text-white font-extrabold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-red-700/10 hover:shadow-red-650/15"
          >
            <Plus size={14} /> Nueva Salida
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-xl transition-all cursor-pointer"
            title={isExpanded ? "Contraer Módulo" : "Expandir Módulo"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Salidas */}
            <div
              onClick={() => setStatusFilter("all")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 border-slate-200/80 hover:bg-slate-100 text-slate-800"
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-wider block font-mono ${statusFilter === "all" ? "text-slate-300" : "text-slate-400"}`}>
                Total Salidas
              </span>
              <div className="text-2xl font-black mt-1 font-mono">{totalCount}</div>
              <span className={`text-[10px] font-medium block mt-0.5 ${statusFilter === "all" ? "text-slate-400" : "text-slate-500"}`}>
                Histórico general
              </span>
            </div>

            {/* Equipos en Préstamo (Activos) */}
            <div
              onClick={() => setStatusFilter("prestado")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "prestado"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/70 text-amber-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block font-mono ${statusFilter === "prestado" ? "text-amber-100" : "text-amber-700"}`}>
                  En Préstamo (Activos)
                </span>
                <Clock size={14} className={statusFilter === "prestado" ? "text-white" : "text-amber-600"} />
              </div>
              <div className="text-2xl font-black mt-1 font-mono">{activeLoans.length}</div>
              <span className={`text-[10px] font-medium block mt-0.5 ${statusFilter === "prestado" ? "text-amber-100" : "text-amber-800"}`}>
                Pendientes por devolver
              </span>
            </div>

            {/* Equipos Devueltos / Entregados */}
            <div
              onClick={() => setStatusFilter("devuelto")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "devuelto"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/70 text-emerald-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block font-mono ${statusFilter === "devuelto" ? "text-emerald-100" : "text-emerald-700"}`}>
                  Ya Entregados
                </span>
                <CheckCircle2 size={14} className={statusFilter === "devuelto" ? "text-white" : "text-emerald-600"} />
              </div>
              <div className="text-2xl font-black mt-1 font-mono">{returnedLoans.length}</div>
              <span className={`text-[10px] font-medium block mt-0.5 ${statusFilter === "devuelto" ? "text-emerald-100" : "text-emerald-800"}`}>
                Reingresados al stock
              </span>
            </div>

            {/* Préstamos Vencidos */}
            <div
              onClick={() => setStatusFilter("vencido")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "vencido"
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/70 text-rose-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block font-mono ${statusFilter === "vencido" ? "text-rose-100" : "text-rose-700"}`}>
                  Vencidos
                </span>
                <AlertCircle size={14} className={statusFilter === "vencido" ? "text-white" : "text-rose-600"} />
              </div>
              <div className="text-2xl font-black mt-1 font-mono">{overdueLoans.length}</div>
              <span className={`text-[10px] font-medium block mt-0.5 ${statusFilter === "vencido" ? "text-rose-100" : "text-rose-800"}`}>
                Superaron fecha estimada
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por colaborador, equipo, serie o motivo..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-red-500 transition-all outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-[10px] font-bold font-mono self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todos ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("prestado")}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === "prestado" ? "bg-white text-amber-800 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                En Préstamo ({activeLoans.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("devuelto")}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === "devuelto" ? "bg-white text-emerald-800 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Entregados ({returnedLoans.length})
              </button>
              {overdueLoans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("vencido")}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === "vencido" ? "bg-white text-rose-800 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ⚠️ Vencidos ({overdueLoans.length})
                </button>
              )}
            </div>
          </div>

          {/* List Table of Loans */}
          {filteredLoans.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/60 rounded-3xl border border-slate-200/80 p-6">
              <Package size={36} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-black text-slate-700">No hay registros de salidas con este filtro</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                {searchTerm
                  ? "Intenta con otro término de búsqueda o limpia los filtros."
                  : "Presiona 'Nueva Salida' o utiliza la opción pública en la pantalla de inicio para registrar préstamos."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-400 uppercase tracking-widest font-mono text-[9px] font-black">
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Asignado a / Área</th>
                    <th className="py-3.5 px-4">Equipo / Dispositivo</th>
                    <th className="py-3.5 px-4">Motivo / Destino</th>
                    <th className="py-3.5 px-4">Fechas</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLoans.map((loan) => {
                    const isOverdue =
                      loan.status === "prestado" &&
                      loan.expectedReturnDate &&
                      loan.expectedReturnDate < todayStr;
                    const cType = componentTypes.find((c) => c.id === loan.itemType);

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Status Badge */}
                        <td className="py-4 px-4 whitespace-nowrap align-middle">
                          {loan.status === "devuelto" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono">
                              <CheckCircle2 size={12} className="text-emerald-600" /> ENTREGADO
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-200/80 font-mono animate-pulse">
                              <AlertCircle size={12} className="text-rose-600" /> VENCIDO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                              <Clock size={12} className="text-amber-600" /> EN PRÉSTAMO
                            </span>
                          )}
                        </td>

                        {/* Person Name & Area */}
                        <td className="py-4 px-4 align-middle">
                          <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            {loan.requesterName}
                          </div>
                          {loan.area && (
                            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                              {loan.area}
                            </span>
                          )}
                        </td>

                        {/* Equipment Item */}
                        <td className="py-4 px-4 align-middle">
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{cType?.icon || "📦"}</span>
                            <span>{loan.quantity}x {loan.itemName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {loan.serial && (
                              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                S/N: {loan.serial}
                              </span>
                            )}
                            {loan.inventoryItemId && (
                              <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                Stock descontado
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Purpose & Destination */}
                        <td className="py-4 px-4 align-middle">
                          <div className="font-semibold text-slate-800 text-xs">{loan.purpose}</div>
                          {loan.destination && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              📍 {loan.destination}
                            </div>
                          )}
                          {loan.notes && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                              "{loan.notes}"
                            </div>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="py-4 px-4 whitespace-nowrap align-middle font-mono text-[10px]">
                          <div className="text-slate-600">
                            <span className="text-slate-400 font-bold">Salida: </span>
                            {new Date(loan.checkoutDate).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          {loan.status === "prestado" && loan.expectedReturnDate && (
                            <div className={`mt-0.5 font-bold ${isOverdue ? "text-rose-700 font-black" : "text-slate-500"}`}>
                              <span className="text-slate-400">Devolución est.: </span>
                              {loan.expectedReturnDate}
                            </div>
                          )}
                          {loan.status === "devuelto" && loan.returnedDate && (
                            <div className="mt-0.5 text-emerald-700 font-bold">
                              <span className="text-slate-400">Entregado: </span>
                              {new Date(loan.returnedDate).toLocaleDateString("es-CO", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 whitespace-nowrap text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {loan.status === "prestado" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReturningLoan(loan);
                                  setReturnNotes("Equipo recibido y verificado en buen estado.");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Marcar este equipo como entregado/devuelto al inventario"
                              >
                                <Check size={12} /> Ya se entregó
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedVoucherLoan(loan)}
                              className="text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-1.5 rounded-lg transition-all cursor-pointer"
                              title="Ver / Imprimir Acta de Salida"
                            >
                              <FileText size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingLoanId(loan.id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                              title="Eliminar Registro de Salida"
                            >
                              <Trash2 size={14} />
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
        </div>
      )}

      {/* Modal: Confirmación de "Ya se entregó" / Devolución */}
      {returningLoan && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[350] p-4 font-sans text-slate-900 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-[2rem] p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Registrar Entrega de Equipo</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    Confirmar retorno al inventario
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturningLoan(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Colaborador:</span>
                <span className="font-black text-slate-900">{returningLoan.requesterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Equipo:</span>
                <span className="font-black text-slate-900">
                  {returningLoan.quantity}x {returningLoan.itemName}
                </span>
              </div>
              {returningLoan.inventoryItemId && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 mt-2 font-medium">
                  ✓ Se reincorporarán automáticamente <strong>{returningLoan.quantity} unidad(es)</strong> al stock del inventario.
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 font-mono">
                Observaciones de la Entrega / Estado del Hardware
              </label>
              <textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Indica el estado físico y funcionamiento del equipo recibido..."
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReturningLoan(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Check size={14} /> Confirmar que Ya se Entregó
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver / Imprimir Acta de Salida y Devolución */}
      {selectedVoucherLoan && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[350] p-4 font-sans text-slate-900 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6 my-auto animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-700 font-mono block">
                  Consultorsalud TI
                </span>
                <h3 className="font-black text-slate-900 text-lg">Acta de Salida y Préstamo de Equipo</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherLoan(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Ticket Area */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Registro</span>
                  <span className="text-sm font-black text-red-700">#{selectedVoucherLoan.id.toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block">Estado Actual</span>
                  <span
                    className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                      selectedVoucherLoan.status === "devuelto"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedVoucherLoan.status === "devuelto" ? "DEVUELTO / ENTREGADO" : "EN PRÉSTAMO ACTIVO"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-200">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Asignado a</span>
                  <span className="font-black text-slate-900 text-sm font-sans">{selectedVoucherLoan.requesterName}</span>
                  {selectedVoucherLoan.area && (
                    <span className="text-[11px] text-slate-500 font-sans block mt-0.5">{selectedVoucherLoan.area}</span>
                  )}
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Equipo</span>
                  <span className="font-black text-slate-900 text-sm font-sans">
                    {selectedVoucherLoan.quantity}x {selectedVoucherLoan.itemName}
                  </span>
                  {selectedVoucherLoan.serial && (
                    <span className="text-[11px] text-slate-600 block mt-0.5">S/N: {selectedVoucherLoan.serial}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-200">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Motivo</span>
                  <span className="font-bold text-slate-800 font-sans">{selectedVoucherLoan.purpose}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fecha Salida</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedVoucherLoan.checkoutDate).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {selectedVoucherLoan.status === "devuelto" && selectedVoucherLoan.returnedDate && (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Fecha de Devolución</span>
                    <span className="font-bold text-emerald-900">
                      {new Date(selectedVoucherLoan.returnedDate).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {selectedVoucherLoan.returnNotes && (
                    <p className="text-[11px] text-emerald-700 italic mt-1 font-sans">
                      "{selectedVoucherLoan.returnNotes}"
                    </p>
                  )}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-8 pb-3 grid grid-cols-2 gap-8 border-t border-slate-200">
                <div className="border-t border-slate-400 text-center pt-2">
                  <span className="text-[10px] font-bold text-slate-600 block font-sans">Firma de Entrega / Recibido</span>
                  <span className="text-[9px] text-slate-400 block font-sans">C.C. ___________________</span>
                </div>
                <div className="border-t border-slate-400 text-center pt-2">
                  <span className="text-[10px] font-bold text-slate-600 block font-sans">Firma Responsable TI</span>
                  <span className="text-[9px] text-slate-400 block font-sans">Consultorsalud</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handlePrintVoucher}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer size={15} /> Imprimir Acta
              </button>
              <button
                type="button"
                onClick={() => setSelectedVoucherLoan(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Eliminación */}
      {deletingLoanId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[350] p-4 font-sans text-slate-900 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="w-10 h-10 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>
            <div className="text-center">
              <h3 className="font-black text-slate-900 text-base">¿Eliminar registro de salida?</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Esta acción removerá el registro del historial de salidas permanentemente.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLoanId(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteLoan(deletingLoanId);
                  setDeletingLoanId(null);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
