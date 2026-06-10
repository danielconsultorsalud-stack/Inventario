import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { AssetData, License } from "../types";

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
 * Formats component lists for display
 */
const formatComponent = (val: string | string[] | undefined): string => {
  if (!val) return "";
  if (Array.isArray(val)) return val.join(" | ");
  return val;
};

/**
 * Exports database to google sheets
 */
export const syncDatabaseToGoogleSheet = async (
  token: string,
  spreadsheetId: string,
  database: Record<string, AssetData>,
  licenses: License[]
): Promise<void> => {
  // Define layout/table headers
  const headers = [
    "ID PUESTO",
    "ÁREA / UBICACIÓN",
    "NOMBRE EQUIPO",
    "RESPONSABLE (ASIGNADO A)",
    "PROCESADOR (CPU)",
    "RAM 1",
    "RAM 2",
    "RAM 3",
    "RAM 4",
    "ALMACENAMIENTO 1 (DISCO)",
    "ALMACENAMIENTO 2 (DISCO)",
    "ALMACENAMIENTO 3 (DISCO)",
    "TARJETA MADRE (BOARD)",
    "TARJETA DE VIDEO (GPU)",
    "PANTALLA (MONITOR)",
    "TECLADO",
    "MOUSE",
    "CÁMARA",
    "AURICULARES",
    "LICENCIAS ACTIVAS",
    "COMENTARIOS / OBSERVACIONES"
  ];

  const rows: string[][] = [headers];

  // Helper mapping IDs to location names for visual clarity
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

  // Convert database assets to rows
  Object.entries(database).forEach(([puestoId, d]) => {
    if (!d || !d.nombre_equipo) return;

    // Resolve licenses
    const licenseIds = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
    const licensesText = licenseIds
      .map((id) => licenses.find((l) => l.id === id)?.name || id)
      .join(" / ") || "Ninguna";

    rows.push([
      getFriendlyPuestoName(puestoId),
      d.area_select || "Sin área",
      d.nombre_equipo || "",
      d.asignado_a || "Sin asignar / Genérico",
      formatComponent(d.procesador),
      formatComponent(d.ram1),
      formatComponent(d.ram2),
      formatComponent(d.ram3),
      formatComponent(d.ram4),
      formatComponent(d.alm1),
      formatComponent(d.alm2),
      formatComponent(d.alm3),
      formatComponent(d.board),
      formatComponent(d.video),
      formatComponent(d.pantalla),
      formatComponent(d.teclado),
      formatComponent(d.mouse),
      formatComponent(d.camara),
      formatComponent(d.auriculares),
      licensesText,
      d.comentarios || ""
    ]);
  });

  // Overwrite sheet values
  // We targets 'Sheet1!A1' as standard default sheet range
  const range = "Sheet1!A1";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!response.ok) {
    // If saving fails due to wrong sheet name, try with 'A1' directly (unnamed tab)
    const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=RAW`;
    const fallbackResponse = await fetch(fallbackUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    });

    if (!fallbackResponse.ok) {
      const errText = await fallbackResponse.text();
      throw new Error(`Error al guardar en la hoja de cálculo: ${errText}`);
    }
  }

  // Enhance spreadsheet format (make header bold and color background slightly, auto-resize columns)
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          // Bold and styled header
          {
            repeatCell: {
              range: {
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.85, green: 0.1, blue: 0.1 }, // red styled header matching the app!
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 10
                  },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
          },
          // Alternative auto-resize dimensions
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }
        ]
      }),
    });
  } catch (e) {
    console.warn("No se pudo aplicar el auto-formato a las columnas, ignorando:", e);
  }
};
