import React, { useState, useMemo } from "react";
import {
  Armchair,
  Plus,
  Search,
  Filter,
  User,
  Users,
  Building,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Trash2,
  Edit2,
  Download,
  ArrowRightLeft,
  Tag,
  Package,
  Layers,
  Sparkles,
  ChevronDown,
  X,
  FileSpreadsheet,
  CornerDownRight,
  FolderOpen,
  FileDown
} from "lucide-react";
import { FurnitureItem, FurnitureCategory, FurnitureStatus, FurnitureCondition, Area, Database as AppDatabase } from "../types";
import { generateFurniturePDFReport } from "../utils/pdfGenerator";

export const DEFAULT_FURNITURE_CATEGORIES: FurnitureCategory[] = [
  { id: "silla", name: "Sillas y Asientos", icon: "🪑" },
  { id: "escritorio", name: "Escritorios y Mesas", icon: "🖥️" },
  { id: "cajonera", name: "Cajoneras y Gavetas", icon: "🗄️" },
  { id: "archivador", name: "Archivadores y Lockers", icon: "📑" },
  { id: "mesa_reuniones", name: "Mesas de Reunión", icon: "👥" },
  { id: "estanteria", name: "Estanterías y Armarios", icon: "📚" },
  { id: "ergonomia", name: "Accesorios Ergonómicos", icon: "🦶" },
  { id: "otros", name: "Otros Enseres", icon: "📦" },
];

interface FurnitureModuleProps {
  items: FurnitureItem[];
  knownEmployees: string[];
  areas: Area[];
  database: AppDatabase;
  onAddItem: (item: Omit<FurnitureItem, "id" | "updatedAt">) => void;
  onUpdateItem: (item: FurnitureItem) => void;
  onDeleteItem: (id: string) => void;
  onQuickAssign: (id: string, employeeName: string, workstation?: string, area?: string) => void;
  onQuickUnassign: (id: string) => void;
}

export const FurnitureModule: React.FC<FurnitureModuleProps> = ({
  items,
  knownEmployees,
  areas,
  database,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onQuickAssign,
  onQuickUnassign,
}) => {
  // Navigation / View modes
  const [viewMode, setViewMode] = useState<"catalog" | "byEmployee" | "table">("catalog");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FurnitureItem | null>(null);

  // Quick Reassign Modal state
  const [reassignModalItem, setReassignModalItem] = useState<FurnitureItem | null>(null);
  const [reassignSelectedEmployee, setReassignSelectedEmployee] = useState<string>("");

  // Form fields
  const [formData, setFormData] = useState<{
    name: string;
    type: string;
    code: string;
    quantity: number;
    status: FurnitureStatus;
    condition: FurnitureCondition;
    assignedTo: string;
    workstation: string;
    area: string;
    location: string;
    colorMaterial: string;
    notes: string;
  }>({
    name: "",
    type: "silla",
    code: "",
    quantity: 1,
    status: "disponible",
    condition: "bueno",
    assignedTo: "",
    workstation: "",
    area: "",
    location: "",
    colorMaterial: "",
    notes: "",
  });

  // Map known employees to their assigned workstation info in the office map
  const employeeInfoMap = useMemo(() => {
    const map: { [name: string]: { area?: string; workstationId?: string; workstationLabel?: string } } = {};
    const config = (database && (database["_workspace_config"] as any)) || {};

    const getPuestoLabel = (id: string, name?: string) => {
      if (name) return name;
      if (id === "p-of-carlos") return `${config.oficinaCarlos || "Oficina Carlos"} (Puesto Principal)`;
      if (id === "p-it") return `${config.oficinaCarlos || "Oficina Carlos"} (IT)`;
      if (id === "p-juntas") return config.salaJuntas || "Sala de Juntas";
      if (id === "p-gerencia") return config.oficinaGerencia || "Oficina Gerencia";
      if (id.startsWith("p-")) {
        const num = id.split("-")[1];
        return `Puesto ${num}`;
      }
      return id;
    };

    Object.entries(database).forEach(([deskId, rawDesk]) => {
      const desk = rawDesk as any;
      if (desk?.asignado_a && typeof desk.asignado_a === "string" && desk.asignado_a.trim().length > 0) {
        map[desk.asignado_a.trim()] = {
          area: desk.area_select || "",
          workstationId: deskId,
          workstationLabel: getPuestoLabel(deskId, desk.nombre_equipo),
        };
      }
    });

    return map;
  }, [database]);

  // Combined employees list: knownEmployees from DB + any employee already assigned to furniture
  const allDistinctEmployees = useMemo(() => {
    const set = new Set<string>();
    knownEmployees.forEach((e) => {
      if (e && e.trim()) set.add(e.trim());
    });
    items.forEach((item) => {
      if (item.assignedTo && item.assignedTo.trim()) set.add(item.assignedTo.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [knownEmployees, items]);

  // Open Create Form
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      type: "silla",
      code: `MOB-${String(items.length + 1).padStart(3, "0")}`,
      quantity: 1,
      status: "disponible",
      condition: "bueno",
      assignedTo: "",
      workstation: "",
      area: "",
      location: "Bodega de Mobiliario",
      colorMaterial: "",
      notes: "",
    });
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEditModal = (item: FurnitureItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type || "silla",
      code: item.code || "",
      quantity: item.quantity || 1,
      status: item.status || "disponible",
      condition: item.condition || "bueno",
      assignedTo: item.assignedTo || "",
      workstation: item.workstation || "",
      area: item.area || "",
      location: item.location || "",
      colorMaterial: item.colorMaterial || "",
      notes: item.notes || "",
    });
    setIsFormOpen(true);
  };

  // When selecting an employee in the form, automatically link their workstation & area
  const handleFormEmployeeChange = (employeeName: string) => {
    if (!employeeName) {
      setFormData((prev) => ({
        ...prev,
        assignedTo: "",
        status: "disponible",
        location: prev.location || "Bodega de Mobiliario",
      }));
      return;
    }

    const empInfo = employeeInfoMap[employeeName];
    setFormData((prev) => ({
      ...prev,
      assignedTo: employeeName,
      status: "asignado",
      area: empInfo?.area || prev.area || "",
      workstation: empInfo?.workstationLabel || prev.workstation || "",
      location: empInfo?.workstationLabel ? `Puesto de ${employeeName} (${empInfo.workstationLabel})` : prev.location,
    }));
  };

  // Save (Create or Update)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Por favor ingresa el nombre o descripción del mobiliario.");
      return;
    }

    if (editingItem) {
      onUpdateItem({
        ...editingItem,
        name: formData.name.trim(),
        type: formData.type,
        code: formData.code.trim() || undefined,
        quantity: Math.max(1, Number(formData.quantity) || 1),
        status: formData.status,
        condition: formData.condition,
        assignedTo: formData.assignedTo.trim() || undefined,
        workstation: formData.workstation.trim() || undefined,
        area: formData.area.trim() || undefined,
        location: formData.location.trim() || undefined,
        colorMaterial: formData.colorMaterial.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        assignedDate: formData.assignedTo ? (editingItem.assignedDate || new Date().toISOString()) : undefined,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onAddItem({
        name: formData.name.trim(),
        type: formData.type,
        code: formData.code.trim() || undefined,
        quantity: Math.max(1, Number(formData.quantity) || 1),
        status: formData.status,
        condition: formData.condition,
        assignedTo: formData.assignedTo.trim() || undefined,
        workstation: formData.workstation.trim() || undefined,
        area: formData.area.trim() || undefined,
        location: formData.location.trim() || undefined,
        colorMaterial: formData.colorMaterial.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        assignedDate: formData.assignedTo ? new Date().toISOString() : undefined,
      });
    }

    setIsFormOpen(false);
  };

  // Quick Reassign Submit
  const handleReassignSubmit = () => {
    if (!reassignModalItem) return;

    if (!reassignSelectedEmployee) {
      onQuickUnassign(reassignModalItem.id);
    } else {
      const empInfo = employeeInfoMap[reassignSelectedEmployee];
      onQuickAssign(
        reassignModalItem.id,
        reassignSelectedEmployee,
        empInfo?.workstationLabel,
        empInfo?.area
      );
    }

    setReassignModalItem(null);
    setReassignSelectedEmployee("");
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = (item.code || "").toLowerCase().includes(q);
        const matchAssigned = (item.assignedTo || "").toLowerCase().includes(q);
        const matchNotes = (item.notes || "").toLowerCase().includes(q);
        const matchLocation = (item.location || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchAssigned && !matchNotes && !matchLocation) {
          return false;
        }
      }

      // Category
      if (categoryFilter !== "all" && item.type !== categoryFilter) {
        return false;
      }

      // Status
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Employee
      if (employeeFilter !== "all") {
        if (employeeFilter === "__unassigned__") {
          if (item.assignedTo && item.assignedTo.trim().length > 0) return false;
        } else if (item.assignedTo !== employeeFilter) {
          return false;
        }
      }

      // Area
      if (areaFilter !== "all" && item.area !== areaFilter) {
        return false;
      }

      return true;
    });
  }, [items, searchTerm, categoryFilter, statusFilter, employeeFilter, areaFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalUnits = items.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const assignedUnits = items
      .filter((i) => i.status === "asignado" || !!i.assignedTo)
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const availableUnits = items
      .filter((i) => i.status === "disponible" && !i.assignedTo)
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const maintenanceUnits = items
      .filter((i) => i.status === "mantenimiento")
      .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const uniqueEmployeesWithFurniture = new Set(
      items.filter((i) => i.assignedTo).map((i) => i.assignedTo)
    ).size;

    return {
      totalUnits,
      assignedUnits,
      availableUnits,
      maintenanceUnits,
      uniqueEmployeesWithFurniture,
    };
  }, [items]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Código / Placa",
      "Nombre Mobiliario",
      "Categoría",
      "Cantidad",
      "Estado",
      "Condición",
      "Colaborador Asignado",
      "Área",
      "Puesto / Estación",
      "Ubicación Física",
      "Color / Material",
      "Notas",
      "Fecha Asignación",
    ];

    const getCategoryName = (type: string) => {
      const match = DEFAULT_FURNITURE_CATEGORIES.find((c) => c.id === type);
      return match ? match.name : type;
    };

    let csvContent = "\uFEFF" + headers.join(",") + "\n";

    filteredItems.forEach((item) => {
      const row = [
        item.id,
        item.code || "",
        item.name,
        getCategoryName(item.type),
        String(item.quantity || 1),
        item.status,
        item.condition || "",
        item.assignedTo || "En Bodega / Sin Asignar",
        item.area || "",
        item.workstation || "",
        item.location || "",
        item.colorMaterial || "",
        item.notes || "",
        item.assignedDate || "",
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);

      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_Mobiliario_SIA_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryInfo = (typeId: string) => {
    return (
      DEFAULT_FURNITURE_CATEGORIES.find((c) => c.id === typeId) || {
        id: typeId,
        name: "Otro Enser",
        icon: "📦",
      }
    );
  };

  const getStatusBadge = (status: FurnitureStatus, assignedTo?: string) => {
    if (status === "asignado" || assignedTo) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={11} className="text-emerald-600" /> Asignado
        </span>
      );
    }
    if (status === "disponible") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-blue-50 text-blue-700 border border-blue-200">
          <Package size={11} className="text-blue-600" /> Disponible
        </span>
      );
    }
    if (status === "mantenimiento") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-amber-50 text-amber-700 border border-amber-200">
          <Wrench size={11} className="text-amber-600" /> Mantenimiento
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-slate-100 text-slate-600 border border-slate-200">
        <AlertCircle size={11} /> Baja
      </span>
    );
  };

  const getConditionBadge = (condition?: FurnitureCondition) => {
    switch (condition) {
      case "nuevo":
        return <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-mono">Nuevo</span>;
      case "excelente":
        return <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">Excelente</span>;
      case "bueno":
        return <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">Bueno</span>;
      case "regular":
        return <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">Regular</span>;
      case "malo":
        return <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono">Requiere Cambio</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL DEL MÓDULO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-slate-200 p-6 md:p-7 rounded-[2rem] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-center text-amber-800 shadow-xs shrink-0">
            <Armchair size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black text-slate-900 font-sans tracking-tight">
                Inventario de Mobiliario y Enseres
              </h2>
              <span className="bg-amber-100/80 text-amber-900 border border-amber-200/90 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full font-mono uppercase">
                Módulo Separado
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-1">
              Control de sillas, escritorios, cajoneras y mobiliario asignado al <strong className="text-slate-800 font-bold">mismo personal de la empresa</strong> y puestos de trabajo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Selector de Vistas */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold font-mono">
            <button
              type="button"
              onClick={() => setViewMode("catalog")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "catalog"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => setViewMode("byEmployee")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "byEmployee"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users size={12} className="text-amber-700" /> Por Colaborador
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Tabla
            </button>
          </div>

          <button
            type="button"
            onClick={() => generateFurniturePDFReport(items, areas)}
            className="bg-red-700 hover:bg-red-650 text-white px-3.5 py-2 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-red-700/10 hover:shadow-red-700/20"
            title="Descargar informe oficial de mobiliario en formato PDF"
          >
            <FileDown size={13} className="text-white" /> Exportar PDF
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Descargar listado en CSV"
          >
            <Download size={13} className="text-slate-500" /> Exportar CSV
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-600/20"
          >
            <Plus size={14} /> Registrar Mueble
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider">Total Mobiliario</span>
            <Layers size={15} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{stats.totalUnits}</div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{items.length} activos registrados</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider">Asignado a Personal</span>
            <Users size={15} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{stats.assignedUnits}</div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            En uso por {stats.uniqueEmployeesWithFurniture} colaboradores
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider">En Bodega / Libre</span>
            <Package size={15} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">{stats.availableUnits}</div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Disponibles para asignación</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider">Mantenimiento</span>
            <Wrench size={15} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">{stats.maintenanceUnits}</div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">En reparación técnica o ajuste</p>
        </div>
      </div>

      {/* CATEGORY SELECTOR CARDS (QUICK FILTER) */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
            Filtrar por Categoría de Mobiliario:
          </span>
          {categoryFilter !== "all" && (
            <button
              onClick={() => setCategoryFilter("all")}
              className="text-[10px] text-amber-700 font-bold hover:underline cursor-pointer"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "all"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>✨</span>
            <span>Todos</span>
            <span className="text-[10px] font-mono opacity-80">({items.length})</span>
          </button>
          {DEFAULT_FURNITURE_CATEGORIES.map((cat) => {
            const count = items.filter((i) => i.type === cat.id).length;
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(isSelected ? "all" : cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-[10px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS AVANZADOS */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por mueble, código placa (MOB-...), notas o colaborador..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Colaborador (el mismo personal) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <User size={13} className="text-amber-700 shrink-0" />
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer pr-2 text-xs"
            >
              <option value="all">Personal: Todos</option>
              <option value="__unassigned__">Sin Asignar (En Bodega)</option>
              {allDistinctEmployees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter size={13} className="text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer pr-2 text-xs"
            >
              <option value="all">Estado: Todos</option>
              <option value="asignado">Asignados</option>
              <option value="disponible">Disponibles</option>
              <option value="mantenimiento">Mantenimiento</option>
            </select>
          </div>

          {/* Filtro por Área */}
          {areas.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <Building size={13} className="text-slate-500 shrink-0" />
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer pr-2 text-xs"
              >
                <option value="all">Área: Todas</option>
                {areas.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(searchTerm || categoryFilter !== "all" || statusFilter !== "all" || employeeFilter !== "all" || areaFilter !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("all");
                setStatusFilter("all");
                setEmployeeFilter("all");
                setAreaFilter("all");
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 cursor-pointer"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN VIEW MODE */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 mb-3 border border-amber-100">
            <Armchair size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No se encontraron ítems de mobiliario</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
            {items.length === 0
              ? "Aún no has registrado ningún mueble en este módulo. Registra sillas, escritorios o archivadores asignándolos al personal."
              : "Ningún ítem coincide con los criterios de búsqueda y filtros seleccionados."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus size={14} /> Registrar Primer Mueble
          </button>
        </div>
      ) : viewMode === "catalog" ? (
        /* VISTA 1: CATÁLOGO EN CUADRÍCULA DE FICHAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const catInfo = getCategoryInfo(item.type);
            const isAssigned = item.status === "asignado" || !!item.assignedTo;

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 hover:border-amber-300 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Indicador de categoría en esquina */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg shrink-0">
                      {catInfo.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase font-mono text-amber-800 block">
                        {catInfo.name}
                      </span>
                      {item.code && (
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {item.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {getStatusBadge(item.status, item.assignedTo)}
                  </div>
                </div>

                {/* Título y especificaciones */}
                <div className="mb-4">
                  <h4 className="font-black text-sm text-slate-900 group-hover:text-amber-900 transition-colors line-clamp-2">
                    {item.name}
                  </h4>

                  <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <span className="text-[10px] font-mono font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Cantidad: {item.quantity}
                    </span>
                    {getConditionBadge(item.condition)}
                    {item.colorMaterial && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        🎨 {item.colorMaterial}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 mt-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100 line-clamp-2 italic">
                      "{item.notes}"
                    </p>
                  )}
                </div>

                {/* FICHA DEL COLABORADOR ASIGNADO ("el mismo personal") */}
                <div className="pt-3 border-t border-slate-100 mb-4 bg-slate-50/60 -mx-5 -mb-1 px-5 py-3">
                  {isAssigned && item.assignedTo ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-mono font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Colaborador Asignado:</span>
                        {item.workstation && <span className="text-slate-600 font-bold">{item.workstation}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-[10px] shrink-0 font-mono">
                          {item.assignedTo.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-black text-slate-900 truncate block">
                            {item.assignedTo}
                          </span>
                          {item.area && (
                            <span className="text-[10px] text-emerald-700 font-semibold block leading-tight">
                              Área: {item.area}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5 text-blue-700 font-medium text-[11px]">
                        <Package size={13} />
                        <span>En Bodega / Sin asignar a personal</span>
                      </div>
                    </div>
                  )}

                  {item.location && !item.assignedTo && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      📍 Ubicación: {item.location}
                    </div>
                  )}
                </div>

                {/* BARRA DE ACCIONES RÁPIDAS */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReassignModalItem(item);
                        setReassignSelectedEmployee(item.assignedTo || "");
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Asignar o reasignar a otro colaborador"
                    >
                      <ArrowRightLeft size={11} /> {item.assignedTo ? "Reasignar" : "Asignar"}
                    </button>

                    {item.assignedTo && (
                      <button
                        type="button"
                        onClick={() => onQuickUnassign(item.id)}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        title="Liberar a Bodega (Desasignar)"
                      >
                        Liberar
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                      title="Editar características"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el registro de mobiliario "${item.name}"?`)) {
                          onDeleteItem(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Eliminar de inventario"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "byEmployee" ? (
        /* VISTA 2: AGRUPADO POR COLABORADOR ("EL MISMO PERSONAL") */
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-amber-800 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider font-mono">
                  Mobiliario por Colaborador Activo
                </h4>
                <p className="text-[11px] text-amber-900 font-medium">
                  Visualiza qué muebles y enseres de oficina tiene en custodia cada integrante del personal de ConsultorSalud.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-200/70 text-amber-950 px-2.5 py-1 rounded-xl">
              {allDistinctEmployees.length} Colaboradores
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {allDistinctEmployees.map((emp) => {
              const empItems = items.filter((i) => i.assignedTo === emp);
              const empInfo = employeeInfoMap[emp];

              return (
                <div
                  key={emp}
                  className={`bg-white border rounded-3xl p-5 shadow-xs transition-all ${
                    empItems.length > 0 ? "border-slate-200" : "border-slate-200/60 opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-sm font-mono shrink-0">
                        {emp.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 leading-snug">{emp}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          {empInfo?.area && (
                            <span className="bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-700">
                              {empInfo.area}
                            </span>
                          )}
                          {empInfo?.workstationLabel && (
                            <span className="text-slate-500 font-medium">
                              📍 {empInfo.workstationLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-full border ${
                        empItems.length > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                      }`}
                    >
                      {empItems.length} {empItems.length === 1 ? "mueble" : "muebles"}
                    </span>
                  </div>

                  {empItems.length > 0 ? (
                    <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                      {empItems.map((item) => {
                        const cat = getCategoryInfo(item.type);
                        return (
                          <div
                            key={item.id}
                            className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-sm shrink-0">{cat.icon}</span>
                              <div className="overflow-hidden">
                                <span className="text-xs font-bold text-slate-800 truncate block">
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
                                  {item.code && <span>{item.code}</span>}
                                  <span>Cant: {item.quantity}</span>
                                  {item.condition && <span>Cond: {item.condition}</span>}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onQuickUnassign(item.id)}
                              className="text-[9px] font-bold text-slate-400 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200 px-2 py-1 rounded cursor-pointer shrink-0 transition-all"
                              title="Desvincular y devolver a bodega"
                            >
                              Liberar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-center py-4 bg-slate-50/50 rounded-2xl">
                      <p className="text-[11px] text-slate-400 italic">
                        Sin mobiliario asignado en el sistema
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(null);
                          setFormData({
                            name: "",
                            type: "silla",
                            code: `MOB-${String(items.length + 1).padStart(3, "0")}`,
                            quantity: 1,
                            status: "asignado",
                            condition: "bueno",
                            assignedTo: emp,
                            workstation: empInfo?.workstationLabel || "",
                            area: empInfo?.area || "",
                            location: empInfo?.workstationLabel ? `Puesto de ${emp} (${empInfo.workstationLabel})` : "",
                            colorMaterial: "",
                            notes: "",
                          });
                          setIsFormOpen(true);
                        }}
                        className="mt-2 text-[10px] font-extrabold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1"
                      >
                        <Plus size={11} /> Asignar Mobiliario a {emp}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* SECCIÓN ADICIONAL: EN BODEGA / SIN ASIGNAR */}
            {items.filter((i) => !i.assignedTo).length > 0 && (
              <div className="bg-blue-50/40 border border-blue-200/60 rounded-3xl p-5 shadow-xs md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-blue-700" />
                    <h4 className="font-black text-sm text-blue-950 font-mono">
                      Mobiliario en Bodega / Almacén (Disponibles para Asignar)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                    {items.filter((i) => !i.assignedTo).length} en stock
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {items
                    .filter((i) => !i.assignedTo)
                    .map((item) => {
                      const cat = getCategoryInfo(item.type);
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-blue-100 p-3 rounded-2xl flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-base shrink-0">{cat.icon}</span>
                            <div className="overflow-hidden">
                              <span className="text-xs font-bold text-slate-800 truncate block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Cant: {item.quantity} {item.code ? `• ${item.code}` : ""}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReassignModalItem(item);
                              setReassignSelectedEmployee("");
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-xs"
                          >
                            Asignar
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA 3: TABLA DETALLADA */
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-mono text-[9px] uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="py-3 px-4">Código / Placa</th>
                  <th className="py-3 px-4">Mueble / Activo</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-center">Cant.</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Condición</th>
                  <th className="py-3 px-4">Colaborador Asignado</th>
                  <th className="py-3 px-4">Área / Puesto</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.map((item) => {
                  const cat = getCategoryInfo(item.type);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500 text-[11px]">
                        {item.code || "—"}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 max-w-[220px]">
                        {item.name}
                        {item.colorMaterial && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {item.colorMaterial}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                          <span>{cat.icon}</span> {cat.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(item.status, item.assignedTo)}
                      </td>
                      <td className="py-3 px-4">
                        {getConditionBadge(item.condition)}
                      </td>
                      <td className="py-3 px-4">
                        {item.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-[9px] font-mono shrink-0">
                              {item.assignedTo.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-900">{item.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">En Bodega</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        {item.area || item.workstation || item.location || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReassignModalItem(item);
                              setReassignSelectedEmployee(item.assignedTo || "");
                            }}
                            className="p-1 text-slate-400 hover:text-amber-800 rounded hover:bg-amber-50 cursor-pointer"
                            title="Asignar / Reasignar"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar ${item.name}?`)) onDeleteItem(item.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title="Eliminar"
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
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR MOBILIARIO */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-xl shadow-2xl p-6 md:p-8 relative my-8 animate-fade-in">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-800 text-xl">
                <Armchair size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingItem ? "Editar Mobiliario" : "Registrar Nuevo Mobiliario"}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Configura las especificaciones físicas y la asignación al personal de la empresa.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Categoría y Nombre */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Categoría *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                    required
                  >
                    {DEFAULT_FURNITURE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Nombre / Modelo del Mueble *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Silla Ergonómica Sihoo M57 con cabecero"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Código, Cantidad y Condición */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Placa / Código Activo
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ej. MOB-001"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Condición Física
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as FurnitureCondition })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="excelente">Excelente</option>
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="malo">Malo / Requiere cambio</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN ASIGNACIÓN AL PERSONAL ("EL MISMO PERSONAL") */}
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase font-mono text-amber-950 flex items-center gap-1.5">
                    <User size={13} className="text-amber-700" />
                    Asignación de Personal (Colaborador)
                  </span>
                  <span className="text-[9px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                    Mismo personal del mapa
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">
                      Colaborador Responsable
                    </label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => handleFormEmployeeChange(e.target.value)}
                      className="w-full bg-white border border-amber-300 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600"
                    >
                      <option value="">Sin Asignar (Disponible en Bodega)</option>
                      {allDistinctEmployees.map((emp) => (
                        <option key={emp} value={emp}>
                          {emp} {employeeInfoMap[emp]?.area ? `(${employeeInfoMap[emp]?.area})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">
                      Estado de Disponibilidad
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as FurnitureStatus })}
                      className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    >
                      <option value="asignado">Asignado a Personal</option>
                      <option value="disponible">Disponible en Bodega</option>
                      <option value="mantenimiento">En Mantenimiento</option>
                      <option value="baja">Dado de Baja</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">
                      Área / Departamento
                    </label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="Ej. Desarrollo TI, Gerencia..."
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">
                      Puesto o Ubicación Específica
                    </label>
                    <input
                      type="text"
                      value={formData.workstation}
                      onChange={(e) => setFormData({ ...formData, workstation: e.target.value })}
                      placeholder="Ej. Oficina Carlos, Puesto 5 - Mesa B"
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Color, Material y Notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Color o Material
                  </label>
                  <input
                    type="text"
                    value={formData.colorMaterial}
                    onChange={(e) => setFormData({ ...formData, colorMaterial: e.target.value })}
                    placeholder="Ej. Malla negra, Melamina Roble..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                    Ubicación Física General
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ej. Bodega Piso 2, Sala de Juntas..."
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                  Observaciones / Garantía / Factura
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Detalles adicionales, proveedor, garantía o estado del mueble..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md shadow-amber-600/20"
                >
                  {editingItem ? "Actualizar Mobiliario" : "Guardar Mobiliario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO: ASIGNAR / REASIGNAR COLABORADOR */}
      {reassignModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setReassignModalItem(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <ArrowRightLeft size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Asignar Mobiliario</h4>
                <p className="text-[11px] text-slate-400">{reassignModalItem.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">
                  Seleccionar Colaborador del Sistema
                </label>
                <select
                  value={reassignSelectedEmployee}
                  onChange={(e) => setReassignSelectedEmployee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-600"
                >
                  <option value="">Liberar a Bodega (Sin Asignar)</option>
                  {allDistinctEmployees.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp} {employeeInfoMap[emp]?.area ? `(${employeeInfoMap[emp]?.area})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {reassignSelectedEmployee && employeeInfoMap[reassignSelectedEmployee] && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs space-y-1">
                  <div className="text-[10px] font-bold text-amber-900 font-mono uppercase">
                    Datos del Puesto del Colaborador:
                  </div>
                  <p className="text-amber-950 font-bold">
                    Área: {employeeInfoMap[reassignSelectedEmployee].area || "General"}
                  </p>
                  <p className="text-amber-900">
                    Puesto: {employeeInfoMap[reassignSelectedEmployee].workstationLabel || "No asignado en mapa"}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignModalItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleReassignSubmit}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  Guardar Asignación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
