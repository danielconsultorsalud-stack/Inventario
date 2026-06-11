import crypto from "crypto";

export interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

/**
 * Exchange Google Service Account keys for an OAuth 2.0 access token using standard Node crypto.
 */
export async function getServiceAccountToken(creds: ServiceAccountCreds): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const base64UrlHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64UrlClaim = Buffer.from(JSON.stringify(claim)).toString("base64url");

  const signatureInput = `${base64UrlHeader}.${base64UrlClaim}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signatureInput);
  const signature = signer.sign(creds.private_key, "base64url");

  const jwt = `${signatureInput}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google service account authentication failed: ${errText}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error("No access_token returned by Google OAuth token endpoint");
  }

  return data.access_token;
}

/**
 * Ensures required tabs "Equipos", "Licencias", and "Dados de Baja" exist in the Google Sheet.
 */
async function ensureSheetsExistServer(
  token: string,
  spreadsheetId: string
): Promise<{
  sheetIdEquipos: number;
  sheetIdLicencias: number;
  sheetIdBajas: number;
  titleEquipos: string;
  titleLicencias: string;
  titleBajas: string;
}> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!getRes.ok) {
    const txt = await getRes.text();
    throw new Error(`Google Sheets metadata fetch failed: ${txt}`);
  }
  const meta: any = await getRes.json();
  const sheets: any[] = meta.sheets || [];

  const existingTitles = sheets.map(s => s.properties.title);

  const findTitleCaseInsensitive = (title: string): string | undefined => {
    return existingTitles.find(t => t.toLowerCase() === title.toLowerCase());
  };

  const hasEquipos = findTitleCaseInsensitive("Equipos");
  const hasLicencias = findTitleCaseInsensitive("Licencias");
  const hasBajas = findTitleCaseInsensitive("Dados de Baja");

  const requests: any[] = [];

  // If "Sheet1" or variations exist and we don't have "Equipos", rename it
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
      console.warn("[Sheets Server] Error setting up tabs:", await updateRes.text());
    }

    const refreshRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (refreshRes.ok) {
      const refreshedMeta: any = await refreshRes.json();
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
}

/**
 * Server side implementation of database synchronizer
 */
export async function syncDatabaseToGoogleSheetServer(
  token: string,
  spreadsheetId: string,
  payload: any
): Promise<void> {
  const database = payload.database || {};
  const licenses = payload.licenses || [];
  const inventoryItems = payload.inventoryItems || [];
  const componentTypes = payload.componentTypes || [];
  const decommissionedItems = payload.decommissionedItems || [];

  const sheetIds = await ensureSheetsExistServer(token, spreadsheetId);

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
    (t: any) => !["board", "video", "procesador", "ram", "almacenamiento", "monitor", "wifi", "mouse", "teclado", "camara", "auriculares"].includes(t.id)
  );

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
    ...customClasificaciones.map((c: any) => c.name.toUpperCase()),
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

  Object.entries(database).forEach(([puestoId, d]: [string, any]) => {
    if (!d || !d.nombre_equipo) return;

    const licenseIds = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
    const licensesText = licenseIds
      .map((id: string) => licenses.find((l: any) => l.id === id)?.name || id)
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

    customClasificaciones.forEach((cClass: any) => {
      const val = d[cClass.id];
      rowData.push(formatComponentRef(val as string));
    });

    rowData.push(licensesText);
    rowData.push(d.comentarios || "");

    rowsEquipos.push(rowData);
  });

  const headersLicencias = [
    "ID LICENCIA",
    "SOTWARE / NOMBRE DE LICENCIA",
    "CUPOS PERMITIDOS (LÍMITE)",
    "CANTIDAD ASIGNADA (EN USO)",
    "CUPOS DISPONIBLES",
    "EQUIPOS ASIGNADOS"
  ];
  const rowsLicencias: string[][] = [headersLicencias];

  licenses.forEach((lic: any) => {
    const assignedAssets: string[] = [];
    Object.entries(database).forEach(([_, asset]: [string, any]) => {
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

  (decommissionedItems || []).forEach((item: any) => {
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

  // Batch Clear values
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
    console.warn("Could not clear ranges on Google Sheet:", clearErr);
  }

  // Batch Update values
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
    throw new Error(`Google Sheets batchWrite failed: ${errText}`);
  }

  // Format styles
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
                  backgroundColor: { red: 0.1, green: 0.15, blue: 0.2 },
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
                  backgroundColor: { red: 0.05, green: 0.25, blue: 0.2 },
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
                  backgroundColor: { red: 0.35, green: 0.1, blue: 0.1 },
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
    console.warn("Could not apply styles to Google Sheet:", e);
  }
}
