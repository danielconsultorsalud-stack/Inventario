import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { AssetData, License, DecommissionedItem } from "../types";

// Re-use the Firebase app configuration
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep token in memory
let cachedAccessToken: string | null = null;

export const loginWithGoogleSheets = async (): Promise<{ user: User; token: string } | null> => {
  const provider = new GoogleAuthProvider();
  // Request sheets write permission
  provider.addScope("https://www.googleapis.com/auth/spreadsheets");
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("No se obtuvo el token de acceso de Google Sheets.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, token: cachedAccessToken };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const getSheetsToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleSheets = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Creates a new spreadsheet in Google Sheets with the default columns.
 */
export const createInventorySpreadsheet = async (token: string, title?: string): Promise<{ id: string; url: string }> => {
  const sheetTitle = title || "SIA CLOUD - Inventario de Equipos y Licencias";
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: sheetTitle,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al crear la hoja en Google Sheets: ${errText}`);
  }

  const data = await response.json();
  return {
    id: data.spreadsheetId,
    url: data.spreadsheetUrl,
  };
};

/**
 * Helper to ensure the spreadsheet has the correct worksheets: "Equipos", "Licencias", "Dados de Baja"
 */
export const ensureSheetsExist = async (
  token: string,
  spreadsheetId: string
): Promise<{
  sheetIdEquipos: number;
  sheetIdLicencias: number;
  sheetIdBajas: number;
  titleEquipos: string;
  titleLicencias: string;
  titleBajas: string;
}> => {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!getRes.ok) {
    const txt = await getRes.text();
    throw new Error(`No se pudo obtener la estructura de Google Sheets: ${txt}`);
  }
  const meta = await getRes.json();
  const sheets: any[] = meta.sheets || [];
  
  const existingTitles = sheets.map(s => s.properties.title);
  
  const findTitleCaseInsensitive = (title: string): string | undefined => {
    return existingTitles.find(t => t.toLowerCase() === title.toLowerCase());
  };

  const hasEquipos = findTitleCaseInsensitive("Equipos");
  const hasLicencias = findTitleCaseInsensitive("Licencias");
  const hasBajas = findTitleCaseInsensitive("Dados de Baja");

  const requests: any[] = [];
  
  // Decide if we should rename standard Sheet1 or Hoja 1 or Hoja1 to Equipos
  let renameSheet1 = false;
  const sheet1Obj = sheets.find(s => s.properties.title === "Sheet1" || s.properties.title === "Hoja 1" || s.properties.title === "Hoja1");
  if (!hasEquipos && sheet1Obj) {
    renameSheet1 = true;
  }

  if (renameSheet1 && sheet1Obj) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: sheet1Obj.properties.sheetId,
          title: "Equipos"
        },
        fields: "title"
      }
    });
  } else if (!hasEquipos) {
    requests.push({
      addSheet: {
        properties: {
          title: "Equipos"
        }
      }
    });
  }

  if (!hasLicencias) {
    requests.push({
      addSheet: {
        properties: {
          title: "Licencias"
        }
      }
    });
  }

  if (!hasBajas) {
    requests.push({
      addSheet: {
        properties: {
          title: "Dados de Baja"
        }
      }
    });
  }

  if (requests.length > 0) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests })
    });
    if (!updateRes.ok) {
      console.warn("No se pudieron inicializar todas las pestañas de hojas:", await updateRes.text());
    }

    // Refresh to get any newly created sheetIds and updated names
    const refreshRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (refreshRes.ok) {
      const refreshedMeta = await refreshRes.json();
      const updatedSheets: any[] = refreshedMeta.sheets || [];
      return {
        sheetIdEquipos: updatedSheets.find(s => s.properties.title.toLowerCase() === "equipos")?.properties.sheetId ?? updatedSheets[0]?.properties.sheetId ?? 0,
        sheetIdLicencias: updatedSheets.find(s => s.properties.title.toLowerCase() === "licencias")?.properties.sheetId ?? 0,
        sheetIdBajas: updatedSheets.find(s => s.properties.title.toLowerCase() === "dados de baja")?.properties.sheetId ?? 0,
        titleEquipos: updatedSheets.find(s => s.properties.title.toLowerCase() === "equipos")?.properties.title ?? "Equipos",
        titleLicencias: updatedSheets.find(s => s.properties.title.toLowerCase() === "licencias")?.properties.title ?? "Licencias",
        titleBajas: updatedSheets.find(s => s.properties.title.toLowerCase() === "dados de baja")?.properties.title ?? "Dados de Baja"
      };
    }
  }

  return {
    sheetIdEquipos: sheets.find(s => s.properties.title.toLowerCase() === "equipos")?.properties.sheetId ?? sheets[0]?.properties.sheetId ?? 0,
    sheetIdLicencias: sheets.find(s => s.properties.title.toLowerCase() === "licencias")?.properties.sheetId ?? 0,
    sheetIdBajas: sheets.find(s => s.properties.title.toLowerCase() === "dados de baja")?.properties.sheetId ?? 0,
    titleEquipos: sheets.find(s => s.properties.title.toLowerCase() === "equipos")?.properties.title ?? "Equipos",
    titleLicencias: sheets.find(s => s.properties.title.toLowerCase() === "licencias")?.properties.title ?? "Licencias",
    titleBajas: sheets.find(s => s.properties.title.toLowerCase() === "dados de baja")?.properties.title ?? "Dados de Baja"
  };
};

/**
 * Exports database (Equipos), licenses (Licencias) and decommissioned items (Dados de Baja) to Google Sheets
 */
export const syncDatabaseToGoogleSheet = async (
  token: string,
  spreadsheetId: string,
  database: Record<string, AssetData>,
  licenses: License[],
  inventoryItems: any[],
  componentTypes: any[],
  decommissionedItems: DecommissionedItem[]
): Promise<void> => {
  // Ensure all tabs exist and obtain their sheet IDs and exact titles
  const sheetIds = await ensureSheetsExist(token, spreadsheetId);

  const formatComponentSingle = (val: string): string => {
    if (!val || val === "Ninguno / Libre") return "Ninguno / Libre";
    const invItem = (inventoryItems || []).find((item: any) => item.id === val);
    return invItem ? invItem.name : val;
  };

  const formatComponentRef = (val: string | string[] | undefined): string => {
    if (!val) return "Ninguno / Libre";
    if (Array.isArray(val)) {
      return val.map((v) => formatComponentSingle(v)).join(" | ");
    }
    return formatComponentSingle(val);
  };

  const customClasificaciones = (componentTypes || []).filter(
    (t) => !["board", "video", "procesador", "ram", "almacenamiento", "monitor", "wifi", "mouse", "teclado", "camara", "auriculares"].includes(t.id)
  );

  // 1. POPULATE CONTROLLER LIST: "Equipos"
  const headersEquipos = [
    "ID PUESTO",
    "ÁREA / UBICACIÓN",
    "NOMBRE EQUIPO",
    "RESPONSABLE (ASIGNADO A)",
    "TARJETA MADRE (BOARD)",
    "PROCESADOR (CPU)",
    "RAM 1",
    "RAM 2",
    "RAM 3",
    "RAM 4",
    "ALMACENAMIENTO 1 (DISCO)",
    "ALMACENAMIENTO 2 (DISCO)",
    "ALMACENAMIENTO 3 (DISCO)",
    "ALMACENAMIENTO 4 (DISCO)",
    "TARJETA DE VIDEO (GPU)",
    "PANTALLA (MONITOR 1)",
    "PANTALLA (MONITOR 2)",
    "RED / WIFI",
    "TECLADO",
    "MOUSE",
    "CÁMARA",
    "AURICULARES",
    "OTROS COMPONENTES",
    ...customClasificaciones.map((c) => c.name.toUpperCase()),
    "LICENCIAS ACTIVAS",
    "COMENTARIOS / OBSERVACIONES"
  ];

  const rowsEquipos: string[][] = [headersEquipos];

  const getFriendlyPuestoName = (id: string) => {
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
      return `Puesto ${num} (${location})`;
    }
    return id;
  };

  Object.entries(database).forEach(([puestoId, d]) => {
    if (!d || !d.nombre_equipo) return;

    // Resolve licenses
    const licenseIds = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
    const licensesText = licenseIds
      .map((id) => licenses.find((l) => l.id === id)?.name || id)
      .join(" / ") || "Ninguna";

    const rowData = [
      getFriendlyPuestoName(puestoId),
      d.area_select || "Sin área",
      d.nombre_equipo || "",
      d.asignado_a || "Sin asignar / Genérico",
      formatComponentRef(d.board),
      formatComponentRef(d.procesador),
      formatComponentRef(d.ram1),
      formatComponentRef(d.ram2),
      formatComponentRef(d.ram3),
      formatComponentRef(d.ram4),
      formatComponentRef(d.alm1),
      formatComponentRef(d.alm2),
      formatComponentRef(d.alm3),
      formatComponentRef(d.alm4),
      formatComponentRef(d.video),
      formatComponentRef(d.mon1),
      formatComponentRef(d.mon2),
      formatComponentRef(d.wifi),
      formatComponentRef(d.teclado),
      formatComponentRef(d.mouse),
      formatComponentRef(d.camara),
      formatComponentRef(d.auriculares),
      formatComponentRef(d.otros),
    ];

    customClasificaciones.forEach((cClass) => {
      const val = d[cClass.id];
      rowData.push(formatComponentRef(val as string));
    });

    rowData.push(licensesText);
    rowData.push(d.comentarios || "");

    rowsEquipos.push(rowData);
  });

  // 2. POPULATE SOFTWARE LICENSES LIST: "Licencias"
  const headersLicencias = [
    "ID LICENCIA",
    "SOTWARE / NOMBRE DE LICENCIA",
    "CUPOS PERMITIDOS (LÍMITE)",
    "CANTIDAD ASIGNADA (EN USO)",
    "CUPOS DISPONIBLES",
    "EQUIPOS ASIGNADOS"
  ];
  const rowsLicencias: string[][] = [headersLicencias];

  licenses.forEach((lic) => {
    const assignedAssets: string[] = [];
    Object.entries(database).forEach(([_, asset]) => {
      if (!asset || !asset.nombre_equipo) return;
      const licIds = asset.licencia_ids || (asset.licencia_id ? [asset.licencia_id] : []);
      if (licIds.includes(lic.id)) {
        assignedAssets.push(asset.nombre_equipo);
      }
    });

    const assignedCount = assignedAssets.length;
    const available = lic.limit - assignedCount;
    const assignedText = assignedAssets.join(" / ") || "Ningún equipo asignado";

    rowsLicencias.push([
      lic.id,
      lic.name,
      String(lic.limit),
      String(assignedCount),
      String(available),
      assignedText
    ]);
  });

  // 3. POPULATE DECOMMISSIONED ITEMS LIST: "Dados de Baja"
  const headersBajas = [
    "ID DE REGISTRO",
    "COMPONENTE",
    "TIPO DE COMPONENTE",
    "NÚMERO DE SERIE",
    "CANTIDAD",
    "MOTIVO DE LA BAJA",
    "PUESTO DE ORIGEN",
    "FECHA Y HORA DE BAJA"
  ];
  const rowsBajas: string[][] = [headersBajas];

  (decommissionedItems || []).forEach((item) => {
    rowsBajas.push([
      item.id,
      item.name || "Sin nombre",
      item.type || "Desconocido",
      item.serial || "S/N",
      String(item.quantity || 1),
      item.reason || "Sin especificar",
      item.originalWorkstation || "Desconocido",
      item.timestamp ? new Date(item.timestamp).toLocaleString("es-ES") : "Sin fecha"
    ]);
  });

  // 4. BATCH CLEAR OLD WORKBOOK VALUES (avoids visual leftovers from previous runs that had more rows)
  try {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
    await fetch(clearUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ranges: [
          `'${sheetIds.titleEquipos}'!A1:Z500`,
          `'${sheetIds.titleLicencias}'!A1:Z200`,
          `'${sheetIds.titleBajas}'!A1:Z1000`
        ]
      })
    });
  } catch (clearErr) {
    console.warn("No se pudo limpiar los rangos anteriores, continuando con sobreescritura directa:", clearErr);
  }

  // 5. WRITE VALUES USING BATCHUPDATE
  const batchWriteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const writeResponse = await fetch(batchWriteUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: [
        {
          range: `'${sheetIds.titleEquipos}'!A1`,
          values: rowsEquipos
        },
        {
          range: `'${sheetIds.titleLicencias}'!A1`,
          values: rowsLicencias
        },
        {
          range: `'${sheetIds.titleBajas}'!A1`,
          values: rowsBajas
        }
      ]
    })
  });

  if (!writeResponse.ok) {
    const errText = await writeResponse.text();
    throw new Error(`Error escribiendo datos multidocumento en Sheets: ${errText}`);
  }

  // 6. BEAUTIFUL AUTO-FORMATS (Header background colors & bolds, and column resizing)
  try {
    const formatUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(formatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          // Styled Header for "Equipos" (Red Accent)
          {
            repeatCell: {
              range: {
                sheetId: sheetIds.sheetIdEquipos,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headersEquipos.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.15, blue: 0.2 }, // Sleek dark slate
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 9
                  },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
          },
          // Styled Header for "Licencias" (Teal/Blue Accent)
          {
            repeatCell: {
              range: {
                sheetId: sheetIds.sheetIdLicencias,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headersLicencias.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.05, green: 0.25, blue: 0.2 }, // Dark pine green
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 9
                  },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
          },
          // Styled Header for "Dados de Baja" (Bordeaux/Orange Dark Accent)
          {
            repeatCell: {
              range: {
                sheetId: sheetIds.sheetIdBajas,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headersBajas.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.35, green: 0.1, blue: 0.1 }, // Burgundy / crimson theme
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 9
                  },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
          },
          // Auto-resize dimensions of headers for Equipos
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetIds.sheetIdEquipos,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headersEquipos.length
              }
            }
          },
          // Auto-resize dimensions of headers for Licencias
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetIds.sheetIdLicencias,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headersLicencias.length
              }
            }
          },
          // Auto-resize dimensions of headers for Bajas
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetIds.sheetIdBajas,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headersBajas.length
              }
            }
          }
        ]
      })
    });
  } catch (e) {
    console.warn("No se pudo aplicar el auto-formato estético a las columnas, ignorando:", e);
  }
};
