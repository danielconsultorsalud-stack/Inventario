import { jsPDF } from "jspdf";
import { Database, ComponentType, License, InventoryItem, AssetData, EquipmentLoan } from "../types";

// Helper function to count assignments in all workstations
const getActiveAssignmentsCount = (itemId: string, database: Database): number => {
  let count = 0;
  for (const desk of Object.values(database)) {
    if (!desk) continue;
    for (const val of Object.values(desk)) {
      if (val === itemId) {
        count++;
      }
    }
  }
  return count;
};

export const generatePDFReport = (
  database: Database,
  componentTypes: ComponentType[],
  licenses: License[],
  inventoryItems: InventoryItem[]
) => {
  // Create jsPDF instance with standard A4 settings (width 210mm, height 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  let cursorY = 20;

  // Render header / footer templates automatically on pages
  const addHeaderDecoration = (pageNumber: number) => {
    // Header accent bar
    doc.setFillColor(164, 0, 0); // brand red #a40000
    doc.rect(0, 0, pageWidth, 5, "F");

    // Top Right Logo branding mock
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("SIA CLOUD — CONSULTORSALUD IT", pageWidth - marginX, 12, { align: "right" });

    // Footer decoration line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generado el ${new Date().toLocaleString("es-CO")}  |  Página ${pageNumber}`,
      marginX,
      pageHeight - 10
    );
  };

  const checkPageOverflow = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 20) {
      doc.addPage();
      const nextPageNum = (doc as any).internal.getNumberOfPages();
      addHeaderDecoration(nextPageNum);
      cursorY = 24;
    }
  };

  // 1. FIRST PAGE DECORATIONS
  addHeaderDecoration(1);

  // Big Display Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // deep slate
  doc.text("INFORME DE CONTROL TI & AUDITORÍA DE INFRAESTRUCTURA", marginX, cursorY);
  cursorY += 6;

  // Subtitle / Organization
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(164, 0, 0); // red accent
  doc.text("SISTEMA DE INVENTARIO DE ACTIVOS (SIA)", marginX, cursorY);
  cursorY += 12;

  // Metadata Card Block
  doc.setFillColor(248, 250, 252); // light slate gray background
  doc.setDrawColor(226, 232, 240); // borders
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 30, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("RESUMEN DE METAS Y MÉTRICAS:", marginX + 5, cursorY + 6);

  // Compute counters
  const totalPuestos = 22; // total map nodes
  const desksWithEquipment = Object.values(database).filter((d) => d && d.nombre_equipo).length;
  const freeDesksCount = Math.max(0, totalPuestos - desksWithEquipment);
  const totalStockItems = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`* Total Puestos de Trabajo Registrados: ${totalPuestos}`, marginX + 5, cursorY + 12);
  doc.text(`* Equipos Instalados y Operativos: ${desksWithEquipment} de ${totalPuestos}`, marginX + 5, cursorY + 17);
  doc.text(`* Puestos de Trabajo Disponibles / Libres: ${freeDesksCount}`, marginX + 5, cursorY + 22);

  doc.text(`* Licencias de Software Definidas: ${licenses.length}`, marginX + 95, cursorY + 12);
  doc.text(`* Tipos de Componentes Soportados: ${componentTypes.length}`, marginX + 95, cursorY + 17);
  doc.text(`* Unidades Totales en Almacén TI: ${totalStockItems}`, marginX + 95, cursorY + 22);

  cursorY += 38;

  // FORMAT COMPONENT VALUE HELPER
  const formatComponentLabel = (val: string | undefined): string => {
    if (!val) return "Ninguno / Libre";
    const invItem = inventoryItems.find((item) => item.id === val);
    return invItem ? invItem.name : val;
  };

  // 2. SECCIÓN: LICENCIAS DE SOFTWARE ACTIVES
  checkPageOverflow(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text("I. REGISTRO DE CUOTAS Y LICENCIAS DE SOFTWARE (ESTADOS)", marginX, cursorY);
  cursorY += 25; // added spacing before drawing items

  // Draw separator line
  doc.setDrawColor(164, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY - 18, marginX + 45, cursorY - 18);

  // Table Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Nombre Completo de la Licencia", marginX + 2, cursorY - 12);
  doc.text("Cuota / Máx", marginX + 115, cursorY - 12);
  doc.text("Activadas", marginX + 140, cursorY - 12);
  doc.text("Disponibles", marginX + 165, cursorY - 12);

  // Header bottom border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginX, cursorY - 9, pageWidth - marginX, cursorY - 9);

  if (licenses.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No se registran licencias de software activas en este informe.", marginX + 2, cursorY - 3);
    cursorY += 5;
  } else {
    licenses.forEach((lic) => {
      checkPageOverflow(10);
      const used = Object.values(database).filter((d) => {
        if (!d) return false;
        const ids = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
        return ids.includes(lic.id);
      }).length;
      const free = Math.max(0, lic.limit - used);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      
      const truncatedLicName = lic.name.length > 50 ? lic.name.slice(0, 47) + "..." : lic.name;
      doc.text(truncatedLicName, marginX + 2, cursorY - 3);

      doc.setFont("helvetica", "mono");
      doc.text(`${lic.limit} ud`, marginX + 115, cursorY - 3);
      doc.text(`${used} ud`, marginX + 140, cursorY - 3);
      doc.text(`${free} ud`, marginX + 165, cursorY - 3);

      // Label if license is exhausted
      if (used >= lic.limit) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(225, 29, 72); // rose deep
        doc.text("[LÍMITE ALCANZADO]", marginX + 115, cursorY + 1.5, { align: "left" });
        doc.setTextColor(51, 65, 85);
      }

      doc.setDrawColor(240, 240, 240);
      doc.line(marginX, cursorY + 3, pageWidth - marginX, cursorY + 3);
      cursorY += 10;
    });
  }

  cursorY += 10;

  // 3. SECCIÓN: INVENTARIO DE HARDWARE EN STOCK (ALMACENADO)
  checkPageOverflow(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text("II. DISPONIBILIDAD DE HARDWARE Y COMPONENTES EN ALMACÉN TI", marginX, cursorY);
  cursorY += 8;

  doc.setDrawColor(164, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY - 6, marginX + 45, cursorY - 6);

  // Table Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Descripción del Componente", marginX + 2, cursorY);
  doc.text("Clasificación", marginX + 85, cursorY);
  doc.text("Código S/N", marginX + 115, cursorY);
  doc.text("Asignados", marginX + 145, cursorY);
  doc.text("Stock Libre", marginX + 165, cursorY);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(marginX, cursorY + 3, pageWidth - marginX, cursorY + 3);
  cursorY += 10;

  if (inventoryItems.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No hay componentes registrados en el catálogo de almacén.", marginX + 2, cursorY - 3);
    cursorY += 5;
  } else {
    inventoryItems.forEach((item) => {
      checkPageOverflow(12);
      const assigned = getActiveAssignmentsCount(item.id, database);
      const free = Math.max(0, item.quantity - assigned);
      const matchedType = componentTypes.find((t) => t.id === item.type);
      const typeLabel = matchedType ? matchedType.name : item.type; // Removed icon emoji here

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      // Handle item name truncate if it is too long (limit to 34 chars to avoid overlapping column 85)
      const truncatedName = item.name.length > 34 ? item.name.slice(0, 31) + "..." : item.name;
      doc.text(truncatedName, marginX + 2, cursorY - 3);

      doc.setFont("helvetica", "normal");
      const truncatedType = typeLabel.length > 18 ? typeLabel.slice(0, 16) + "..." : typeLabel;
      doc.text(truncatedType, marginX + 85, cursorY - 3);

      doc.setFont("helvetica", "normal");
      const cleanSerial = item.serial || "S/N disponible";
      const truncatedSerial = cleanSerial.length > 18 ? cleanSerial.slice(0, 16) + "..." : cleanSerial;
      doc.text(truncatedSerial, marginX + 115, cursorY - 3);

      doc.setFont("helvetica", "bold");
      doc.text(`${assigned} u.`, marginX + 145, cursorY - 3);

      if (free === 0) {
        doc.setTextColor(225, 29, 72);
        doc.text("0 (SIN STOCK)", marginX + 165, cursorY - 3);
      } else {
        doc.setTextColor(16, 185, 129); // emerald
        doc.text(`${free} libres`, marginX + 165, cursorY - 3);
      }
      doc.setTextColor(51, 65, 85);

      doc.setDrawColor(240, 240, 240);
      doc.line(marginX, cursorY + 2, pageWidth - marginX, cursorY + 2);
      cursorY += 9;
    });
  }

  cursorY += 12;

  // 4. SECCIÓN: CONFIGURACIÓN POR EQUIPOS EN PUESTO (SABANA DETALLADA)
  checkPageOverflow(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text("III. DETALLE COMPLETO DE DISPOSITIVOS CONFIGURADOS (EQUIPOS)", marginX, cursorY);
  cursorY += 8;

  doc.setDrawColor(164, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY - 6, marginX + 45, cursorY - 6);

  const activePuestoKeys = Object.keys(database).filter((id) => database[id] && database[id].nombre_equipo);

  if (activePuestoKeys.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No se registran equipos configurados activos en el mapa interactivo.", marginX + 2, cursorY);
    cursorY += 8;
  } else {
    // Sort keys alphabetically/numerically
    activePuestoKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    activePuestoKeys.forEach((key) => {
      const d = database[key];
      if (!d) return;

      // We first check page overflow to print the block safely (header is now 12mm deep + spacer)
      checkPageOverflow(26);

      // Card Header with height = 12mm to host 2-line clean visual block mapping
      doc.setFillColor(243, 244, 246);
      doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 12, "F");

      // Line 1 Content: workstation name and team identifier info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(164, 0, 0);
      
      const cleanKey = key.replace("p-", "PUESTO ").replace("of-", "OFICINA ").toUpperCase();
      const truncatedKey = cleanKey.length > 25 ? cleanKey.slice(0, 23) + "..." : cleanKey;
      doc.text(truncatedKey, marginX + 3, cursorY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      const eqLabelText = d.nombre_equipo || "Sin Nombre";
      const truncatedEquipoText = eqLabelText.length > 35 ? eqLabelText.slice(0, 32) + "..." : eqLabelText;
      doc.text(`Equipo: ${truncatedEquipoText}`, marginX + 75, cursorY + 4.5);

      // Line 2 Content: assigned username and department classification area
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const uLabelText = d.asignado_a || "Sin asignar / Genérico";
      const truncatedUserText = uLabelText.length > 35 ? uLabelText.slice(0, 32) + "..." : uLabelText;
      doc.text(`Asignado: ${truncatedUserText}`, marginX + 3, cursorY + 9.5);

      const areaColorLabel = d.area_select ? `Área: ${d.area_select}` : "Sin Área";
      const truncatedAreaText = areaColorLabel.length > 30 ? areaColorLabel.slice(0, 27) + "..." : areaColorLabel;
      doc.setFont("helvetica", "italic");
      doc.text(truncatedAreaText, marginX + 75, cursorY + 9.5);

      cursorY += 15;

      // Collect specs dynamically
      const specsList: { label: string; value: string }[] = [];

      // Add motherboard
      specsList.push({ label: "Tarjeta Madre (Board)", value: formatComponentLabel(d.board) });

      // Add Processor
      specsList.push({ label: "Procesador (CPU)", value: formatComponentLabel(d.procesador) });

      // Add ram module
      const ramsList = [d.ram1, d.ram2, d.ram3, d.ram4]
        .map((r) => formatComponentLabel(r))
        .filter((r) => r !== "Ninguno / Libre")
        .join(" | ");
      specsList.push({ label: "Memorias RAM", value: ramsList || "Ninguna asignada" });

      // Add storage
      const disksList = [d.alm1, d.alm2, d.alm3, d.alm4]
        .map((di) => formatComponentLabel(di))
        .filter((di) => di !== "Ninguno / Libre")
        .join(" | ");
      specsList.push({ label: "Almacenamientos", value: disksList || "Ninguno asignado" });

      // Add Video Card
      if (d.video && d.video !== "Ninguno / Libre") {
        specsList.push({ label: "Tarjeta de Video (GPU)", value: formatComponentLabel(d.video) });
      }

      // Add Screen
      const monitorsList = [d.mon1, d.mon2]
        .map((m) => formatComponentLabel(m))
        .filter((m) => m !== "Ninguno / Libre")
        .join(" | ");
      specsList.push({ label: "Pantallas/Monitores", value: monitorsList || "Ninguna asignada" });

      // Add Networking
      specsList.push({ label: "Red / WiFi", value: d.wifi ? formatComponentLabel(d.wifi) : "No asignado / Integrado" });

      // Add Otros/Otros Componentes
      if (d.otros && d.otros !== "Ninguno / Libre") {
        specsList.push({ label: "Otros Componentes", value: formatComponentLabel(d.otros) });
      }

      // Add License
      const licIds = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
      const licLabel = licIds.length > 0 
        ? licIds.map((id) => licenses.find((l) => l.id === id)?.name || id).join(" / ")
        : "Sin Licencia Vinculada";
      specsList.push({ label: "Licencias de Software", value: licLabel });

      // Add Peripherals group
      const periphList: string[] = [];
      if (d.mouse && d.mouse !== "Ninguno / Libre") periphList.push(`Mouse [${formatComponentLabel(d.mouse)}]`);
      if (d.teclado && d.teclado !== "Ninguno / Libre") periphList.push(`Teclado [${formatComponentLabel(d.teclado)}]`);
      if (d.camara && d.camara !== "Ninguno / Libre") periphList.push(`Cámara [${formatComponentLabel(d.camara)}]`);
      if (d.auriculares && d.auriculares !== "Ninguno / Libre") periphList.push(`Auriculares [${formatComponentLabel(d.auriculares)}]`);
      if (periphList.length > 0) {
        specsList.push({ label: "Periféricos", value: periphList.join(" | ") });
      }

      // Add dynamic additional custom component types
      const customClasificaciones = componentTypes.filter(
        (t) => !["board", "video", "procesador", "ram", "almacenamiento", "monitor", "wifi", "mouse", "teclado", "camara", "auriculares"].includes(t.id)
      );

      customClasificaciones.forEach((cClass) => {
        const val = d[cClass.id];
        if (val && val !== "Ninguno / Libre" && val !== "") {
          // Explicitly removed icon emoji representation here
          specsList.push({ label: cClass.name, value: formatComponentLabel(val as string) });
        }
      });

      // Add comments if available to the PDF specs sheet
      if (d.comentarios && d.comentarios.trim() !== "") {
        specsList.push({ label: "Observaciones/Comentarios", value: d.comentarios.trim() });
      }

      // Render spec rows vertically with safe line splitting
      specsList.forEach((spec) => {
        const bulletLabel = `•  ${spec.label}:  `;
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        const labelWidth = doc.getTextWidth(bulletLabel);
        
        doc.setFont("helvetica", "normal");
        const maxValWidth = pageWidth - 2 * marginX - 10 - labelWidth;
        const splitText = doc.splitTextToSize(spec.value, maxValWidth);
        const linesCount = Array.isArray(splitText) ? splitText.length : 1;
        
        const blockHeight = 4.2 * linesCount;
        checkPageOverflow(blockHeight + 1);

        // Slate label
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(bulletLabel, marginX + 4, cursorY);

        // Value text
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(splitText, marginX + 4 + labelWidth, cursorY);

        cursorY += blockHeight;
      });

      cursorY += 6;
    });
  }

  // Save the constructed PDF document
  doc.save(`Reporte_Auditoria_IT_SIA_${new Date().toISOString().split("T")[0]}.pdf`);
};

/**
 * Generates a comprehensive PDF report of all or filtered equipment loans
 */
export const generateEquipmentLoansPDFReport = (
  loans: EquipmentLoan[],
  componentTypes: ComponentType[],
  filterTitle?: string
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  let cursorY = 20;

  const addHeaderDecoration = (pageNumber: number) => {
    // Red Accent Bar
    doc.setFillColor(164, 0, 0); // brand red #a40000
    doc.rect(0, 0, pageWidth, 5, "F");

    // Top Right Brand Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("SIA CLOUD — CONSULTORSALUD IT", pageWidth - marginX, 12, { align: "right" });

    // Footer decoration line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);

    // Footer text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generado el ${new Date().toLocaleString("es-CO")}  |  Página ${pageNumber}`,
      marginX,
      pageHeight - 10
    );
  };

  const checkPageOverflow = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 20) {
      doc.addPage();
      const nextPageNum = (doc as any).internal.getNumberOfPages();
      addHeaderDecoration(nextPageNum);
      cursorY = 24;
    }
  };

  // 1. First Page Header
  addHeaderDecoration(1);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59); // deep slate
  doc.text("REPORTE DE CONTROL DE SALIDAS Y PRÉSTAMOS DE EQUIPOS", marginX, cursorY);
  cursorY += 6;

  // Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(164, 0, 0);
  doc.text(
    filterTitle ? `HISTORIAL TI — FILTRO: ${filterTitle.toUpperCase()}` : "HISTORIAL COMPLETO DE PRÉSTAMOS Y SALIDAS DE HARDWARE",
    marginX,
    cursorY
  );
  cursorY += 10;

  // Metrics Box
  const todayStr = new Date().toISOString().split("T")[0];
  const totalCount = loans.length;
  const activeCount = loans.filter((l) => l.status === "prestado").length;
  const returnedCount = loans.filter((l) => l.status === "devuelto").length;
  const overdueCount = loans.filter(
    (l) => l.status === "prestado" && l.expectedReturnDate && l.expectedReturnDate < todayStr
  ).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 26, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("RESUMEN GENERAL DEL ESTADO DE SALIDAS:", marginX + 5, cursorY + 6);

  const colW = (pageWidth - 2 * marginX - 10) / 4;
  const stats = [
    { label: "Total Registros", value: `${totalCount}` },
    { label: "En Préstamo (Activos)", value: `${activeCount}` },
    { label: "Ya Entregados", value: `${returnedCount}` },
    { label: "Vencidos / Fuera Fecha", value: `${overdueCount}` },
  ];

  stats.forEach((stat, i) => {
    const boxX = marginX + 5 + i * colW;
    const boxY = cursorY + 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label, boxX, boxY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (i === 1) doc.setTextColor(217, 119, 6); // amber
    else if (i === 2) doc.setTextColor(16, 185, 129); // emerald
    else if (i === 3 && overdueCount > 0) doc.setTextColor(225, 29, 72); // rose
    else doc.setTextColor(30, 41, 59);

    doc.text(stat.value, boxX, boxY + 6);
  });

  cursorY += 34;

  // Section Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`REGISTROS DETALLADOS (${loans.length} EQUIPO${loans.length === 1 ? "" : "S"})`, marginX, cursorY);
  cursorY += 6;

  if (loans.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("No se encontraron registros de salidas o préstamos con los criterios seleccionados.", marginX, cursorY + 4);
    cursorY += 15;
  } else {
    loans.forEach((loan, index) => {
      const isOverdue =
        loan.status === "prestado" &&
        loan.expectedReturnDate &&
        loan.expectedReturnDate < todayStr;
      
      const compType = componentTypes.find((c) => c.id === loan.itemType);
      const compTypeName = compType ? compType.name : loan.itemType;

      // Estimate card height
      const cardHeight = loan.notes || loan.returnNotes ? 36 : 30;
      checkPageOverflow(cardHeight + 4);

      // Card Box
      doc.setFillColor(255, 255, 255);
      if (loan.status === "devuelto") {
        doc.setDrawColor(209, 250, 229); // light emerald border
      } else if (isOverdue) {
        doc.setDrawColor(254, 205, 211); // light rose border
      } else {
        doc.setDrawColor(254, 243, 199); // light amber border
      }
      doc.setLineWidth(0.4);
      doc.rect(marginX, cursorY, pageWidth - 2 * marginX, cardHeight, "FD");

      // Left Accent Color Strip
      if (loan.status === "devuelto") {
        doc.setFillColor(16, 185, 129); // emerald
      } else if (isOverdue) {
        doc.setFillColor(225, 29, 72); // rose
      } else {
        doc.setFillColor(245, 158, 11); // amber
      }
      doc.rect(marginX, cursorY, 3.5, cardHeight, "F");

      // Top Line: Person & Status Badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate 900
      const personText = `${index + 1}.  ${loan.requesterName}${loan.area ? `  —  [${loan.area}]` : ""}`;
      doc.text(personText, marginX + 6, cursorY + 6);

      // Status text on right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      if (loan.status === "devuelto") {
        doc.setTextColor(5, 150, 105);
        doc.text("ENTREGADO / DEVUELTO", pageWidth - marginX - 4, cursorY + 6, { align: "right" });
      } else if (isOverdue) {
        doc.setTextColor(225, 29, 72);
        doc.text("VENCIDO (FUERA DE PLAZO)", pageWidth - marginX - 4, cursorY + 6, { align: "right" });
      } else {
        doc.setTextColor(217, 119, 6);
        doc.text("EN PRÉSTAMO ACTIVO", pageWidth - marginX - 4, cursorY + 6, { align: "right" });
      }

      // Line 2: Equipment details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const equipText = `Equipo:  ${loan.quantity}x ${loan.itemName}  (${compTypeName})${loan.serial ? `  |  S/N: ${loan.serial}` : ""}`;
      doc.text(equipText, marginX + 6, cursorY + 12);

      // Line 3: Purpose & Destination
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const purposeText = `Motivo: ${loan.purpose}${loan.destination ? `  |  Destino: ${loan.destination}` : ""}`;
      doc.text(purposeText, marginX + 6, cursorY + 17);

      // Line 4: Dates
      const checkoutStr = new Date(loan.checkoutDate).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      let datesText = `Fecha de Salida: ${checkoutStr}`;
      if (loan.expectedReturnDate) {
        datesText += `  |  Devolución Estimada: ${loan.expectedReturnDate}`;
      }
      if (loan.returnedDate) {
        const retStr = new Date(loan.returnedDate).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        datesText += `  |  Devuelto el: ${retStr}`;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(datesText, marginX + 6, cursorY + 22);

      // Line 5 (Optional): Notes
      if (loan.notes || loan.returnNotes) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const noteContent = loan.returnNotes
          ? `Devolución: "${loan.returnNotes}"`
          : `Nota de salida: "${loan.notes}"`;
        const splitNote = doc.splitTextToSize(noteContent, pageWidth - 2 * marginX - 12);
        doc.text(splitNote, marginX + 6, cursorY + 28);
      }

      cursorY += cardHeight + 4;
    });
  }

  // Signatures section
  checkPageOverflow(40);
  cursorY += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("FIRMAS Y CONSTANCIA DE AUDITORÍA TI:", marginX, cursorY);
  cursorY += 16;

  const sigWidth = (pageWidth - 2 * marginX - 20) / 2;

  // Signature 1: TI
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY, marginX + sigWidth, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Responsable de Inventario y Soporte TI", marginX + sigWidth / 2, cursorY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Consultorsalud TI", marginX + sigWidth / 2, cursorY + 8, { align: "center" });

  // Signature 2: Auditor / Jefe
  doc.line(pageWidth - marginX - sigWidth, cursorY, pageWidth - marginX, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Dirección Administrativa / Operaciones", pageWidth - marginX - sigWidth / 2, cursorY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma de Aprobación", pageWidth - marginX - sigWidth / 2, cursorY + 8, { align: "center" });

  // Save PDF
  doc.save(`Reporte_Prestamos_Equipos_SIA_${todayStr}.pdf`);
};

/**
 * Generates an official single-page voucher/receipt PDF for a specific equipment loan
 */
export const generateSingleLoanVoucherPDF = (
  loan: EquipmentLoan,
  componentTypes: ComponentType[]
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  let cursorY = 20;

  // Header Bar
  doc.setFillColor(164, 0, 0); // brand red
  doc.rect(0, 0, pageWidth, 6, "F");

  // Top header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("CONSULTORSALUD TI — DEPARTAMENTO DE TECNOLOGÍA", marginX, 14);
  doc.text(`FOLIO: #${loan.id.toUpperCase()}`, pageWidth - marginX, 14, { align: "right" });

  // Title
  cursorY = 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("ACTA DE SALIDA Y PRÉSTAMO DE EQUIPO", marginX, cursorY);
  cursorY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Constancia oficial de entrega temporal de hardware y componentes de tecnología", marginX, cursorY);
  cursorY += 12;

  // Status block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 18, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ESTADO DEL PRÉSTAMO:", marginX + 6, cursorY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (loan.status === "devuelto") {
    doc.setTextColor(16, 185, 129);
    doc.text("EQUIPO YA ENTREGADO / DEVUELTO AL INVENTARIO", marginX + 6, cursorY + 13);
  } else {
    doc.setTextColor(217, 119, 6);
    doc.text("EN PRÉSTAMO ACTIVO / PENDIENTE DE RETORNO", marginX + 6, cursorY + 13);
  }

  cursorY += 25;

  // Section 1: Beneficiary Information
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(164, 0, 0);
  doc.text("1. DATOS DEL COLABORADOR ASIGNADO", marginX, cursorY);
  cursorY += 5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 22, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Nombre Completo:", marginX + 6, cursorY + 7);
  doc.text("Área / Departamento:", marginX + (pageWidth - 2 * marginX) / 2, cursorY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(loan.requesterName, marginX + 6, cursorY + 14);
  doc.text(loan.area || "No especificada", marginX + (pageWidth - 2 * marginX) / 2, cursorY + 14);

  cursorY += 28;

  // Section 2: Equipment Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(164, 0, 0);
  doc.text("2. ESPECIFICACIONES DEL HARDWARE ENTREGADO", marginX, cursorY);
  cursorY += 5;

  const compType = componentTypes.find((c) => c.id === loan.itemType);
  const compTypeName = compType ? compType.name : loan.itemType;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 32, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Descripción del Dispositivo:", marginX + 6, cursorY + 7);
  doc.text("Cantidad:", marginX + 110, cursorY + 7);
  doc.text("Tipo / Categoría:", marginX + 140, cursorY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(loan.itemName, marginX + 6, cursorY + 13);
  doc.text(`${loan.quantity} und.`, marginX + 110, cursorY + 13);
  doc.text(compTypeName, marginX + 140, cursorY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Número de Serie (S/N):", marginX + 6, cursorY + 22);
  doc.text("Origen:", marginX + 110, cursorY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(loan.serial || "No registrado / Sin serie visible", marginX + 6, cursorY + 27);
  doc.text(loan.inventoryItemId ? "Stock Inventario SIA" : "Equipo General", marginX + 110, cursorY + 27);

  cursorY += 38;

  // Section 3: Purpose, Destination & Dates
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(164, 0, 0);
  doc.text("3. MOTIVO DE SALIDA Y FECHAS DE COMPROMISO", marginX, cursorY);
  cursorY += 5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 30, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Motivo:", marginX + 6, cursorY + 7);
  doc.text("Destino / Ubicación:", marginX + 90, cursorY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(loan.purpose, marginX + 6, cursorY + 12);
  doc.text(loan.destination || "Sede Principal / Trabajo Remoto", marginX + 90, cursorY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Fecha de Salida:", marginX + 6, cursorY + 21);
  doc.text("Fecha Estimada de Devolución:", marginX + 90, cursorY + 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    new Date(loan.checkoutDate).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    marginX + 6,
    cursorY + 26
  );
  doc.text(loan.expectedReturnDate || "Pendiente de definir", marginX + 90, cursorY + 26);

  cursorY += 36;

  // Section 4: Terms
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 22, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TÉRMINOS Y COMPROMISO DE CUIDADO:", marginX + 5, cursorY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const terms =
    "El colaborador declara recibir a satisfacción el equipo aquí descrito en óptimas condiciones de funcionamiento. Se compromete a destinarlo exclusivamente a labores laborales de Consultorsalud, salvaguardar su integridad física y devolverlo al área de TI en la fecha estipulada o ante requerimiento.";
  const splitTerms = doc.splitTextToSize(terms, pageWidth - 2 * marginX - 10);
  doc.text(splitTerms, marginX + 5, cursorY + 10);

  cursorY += 32;

  // Signatures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("CONSTANCIA DE ENTREGA Y RECEPCIÓN:", marginX, cursorY);
  cursorY += 20;

  const sigW = (pageWidth - 2 * marginX - 25) / 2;

  // Left Sig: Colaborador
  doc.setDrawColor(148, 163, 184);
  doc.line(marginX, cursorY, marginX + sigW, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Firma de Recibido / Colaborador", marginX + sigW / 2, cursorY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`C.C. _______________________`, marginX + sigW / 2, cursorY + 8, { align: "center" });
  doc.text(`${loan.requesterName}`, marginX + sigW / 2, cursorY + 12, { align: "center" });

  // Right Sig: TI
  doc.line(pageWidth - marginX - sigW, cursorY, pageWidth - marginX, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Firma de Entrega / Responsable TI", pageWidth - marginX - sigW / 2, cursorY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Consultorsalud TI — Soporte", pageWidth - marginX - sigW / 2, cursorY + 8, { align: "center" });
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-CO")}`, pageWidth - marginX - sigW / 2, cursorY + 12, { align: "center" });

  // Save
  doc.save(`Acta_Salida_Equipo_${loan.id}.pdf`);
};

