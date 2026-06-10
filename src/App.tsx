import React, { useState, useEffect } from "react";
import { Monitor, FileSpreadsheet, Plus, HelpCircle, KeyRound, ClipboardList, FileDown, Database, RefreshCw, CloudUpload, ShieldAlert, X } from "lucide-react";
import { Area, Database as AppDatabase, AssetData, License, InventoryItem, ComponentType, AuditLogEntry, DecommissionedItem } from "./types";
import { OfficeMap } from "./components/OfficeMap";
import { AssetModal } from "./components/AssetModal";
import { AreaManagerModal } from "./components/AreaManagerModal";
import { LicenseManagerModal } from "./components/LicenseManagerModal";
import { ComponentTypeManagerModal } from "./components/ComponentTypeManagerModal";
import { AuditLogModal } from "./components/AuditLogModal";
import { BackupModal } from "./components/BackupModal";
import { Tooltip } from "./components/Tooltip";
import { InventoryModule } from "./components/InventoryModule";
import { DecommissionedModule } from "./components/DecommissionedModule";
import { generatePDFReport } from "./utils/pdfGenerator";
import { db, doc, getDoc, setDoc, onSnapshot } from "./utils/firebase";
import { loginWithGoogleSheets, createInventorySpreadsheet, syncDatabaseToGoogleSheet } from "./utils/googleSheets";

const DEFAULT_AREAS: Area[] = [
  { name: "Administración", color: "#3b82f6" },
  { name: "Desarrollo TI", color: "#10b981" },
  { name: "Soporte Técnico", color: "#f43f5e" },
  { name: "Gerencia", color: "#a855f7" },
  { name: "Diseño & Web", color: "#fbbf24" },
];

const DEFAULT_COMPONENT_TYPES: ComponentType[] = [
  { id: "board", name: "Placas Madre", icon: "⚙️" },
  { id: "procesador", name: "Procesadores", icon: "🧠" },
  { id: "ram", name: "RAMs", icon: "💾" },
  { id: "almacenamiento", name: "Discos (Alm)", icon: "💽" },
  { id: "video", name: "T. Video", icon: "🎮" },
  { id: "wifi", name: "Wifi/Red", icon: "📶" },
  { id: "monitor", name: "Monitores", icon: "🖥️" },
  { id: "mouse", name: "Mouses", icon: "🖱️" },
  { id: "teclado", name: "Teclados", icon: "⌨️" },
  { id: "auriculares", name: "Audífonos", icon: "🎧" },
  { id: "camara", name: "Cámaras", icon: "📷" },
  { id: "otros", name: "Otros", icon: "📦" },
];

export default function App() {
  const clientIdRef = React.useRef(Math.random().toString(36).substring(2, 11));
  const isIncomingUpdate = React.useRef(false);

  // Cloud Sync Configuration State
  const [cloudSyncId, setCloudSyncId] = useState<string>("danielsia");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Database States
  const [database, setDatabase] = useState<AppDatabase>(() => {
    const saved = localStorage.getItem("sia_master_v5");
    return saved ? JSON.parse(saved) : {};
  });

  const [componentTypes, setComponentTypes] = useState<ComponentType[]>(() => {
    const saved = localStorage.getItem("sia_component_types_v5");
    return saved ? JSON.parse(saved) : DEFAULT_COMPONENT_TYPES;
  });

  const [areas, setAreas] = useState<Area[]>(() => {
    const saved = localStorage.getItem("sia_areas_v5");
    return saved ? JSON.parse(saved) : DEFAULT_AREAS;
  });

  const [licenses, setLicenses] = useState<License[]>(() => {
    const saved = localStorage.getItem("sia_licenses_v5");
    return saved ? JSON.parse(saved) : [
      { id: "lic-windows11", name: "Windows 11 Pro Enterprise", limit: 10 },
      { id: "lic-office365", name: "Office 365 Business Premium", limit: 5 },
    ];
  });

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem("sia_inventory_v5");
    return saved ? JSON.parse(saved) : [
      { id: "inv-board-1", name: "ASUS Prime H510M-E LGA1200", type: "board", quantity: 4, notes: "Cajas selladas - Estante A" },
      { id: "inv-board-2", name: "Gigabyte B560M H Ultra", type: "board", quantity: 2, notes: "Caja principal estante A" },
      { id: "inv-cpu-1", name: "Intel Core i5-11400 2.6GHz", type: "procesador", quantity: 6, notes: "Caja de procesadores" },
      { id: "inv-cpu-2", name: "Intel Core i7-11700 3.6GHz", type: "procesador", quantity: 2, notes: "Gabinete de seguridad TI" },
      { id: "inv-ram-1", name: "Kingston Fury Beast DDR4 8GB 3200MHz", type: "ram", quantity: 12, notes: "Cajón de repuestos RAM" },
      { id: "inv-ram-2", name: "Corsair Vengeance LPX DDR4 16GB 3200Mhz", type: "ram", quantity: 8, notes: "Cajón de repuestos RAM" },
      { id: "inv-ssd-1", name: "Crucial P3 NVMe M.2 SSD 500GB", type: "almacenamiento", quantity: 10, notes: "Estante seguro TI" },
      { id: "inv-ssd-2", name: "Kingston A400 SATA SSD 480GB", type: "almacenamiento", quantity: 6, notes: "Cajón de repuestos SSD" },
      { id: "inv-gpu-1", name: "NVIDIA GeForce GTX 1650 4GB", type: "video", quantity: 3, notes: "Rack de tarjetas gráficas" },
      { id: "inv-3", name: "Monitor HP v22v FHD 21.5''", type: "monitor", quantity: 5, notes: "Rack de monitores" },
      { id: "inv-1", name: "Mouse Logitech M170 Inalámbrico", type: "mouse", quantity: 5, notes: "Armario TI - Caja Principal" },
      { id: "inv-2", name: "Teclado Redragon Dragonborn K630", type: "teclado", quantity: 3, notes: "Estante Auxiliar 2" },
      { id: "inv-4", name: "Cámara Web Full HD Genius 1080p", type: "camara", quantity: 3, notes: "Soporte Técnico" },
    ];
  });

  // Modal Asset Settings
  const [selectedPuesto, setSelectedPuesto] = useState<{ id: string; label: string } | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  // Modal Area Manager Settings
  const [isAreaManagerOpen, setIsAreaManagerOpen] = useState(false);

  // Modal License Manager Settings
  const [isLicenseManagerOpen, setIsLicenseManagerOpen] = useState(false);

  // Modal Component Type Manager Settings
  const [isComponentTypeManagerOpen, setIsComponentTypeManagerOpen] = useState(false);

  // Modal Audit Logs Settings
  const [isAuditLogModalOpen, setIsAuditLogModalOpen] = useState(false);

  // Modal Backup Settings
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudPasswordInput, setCloudPasswordInput] = useState("");
  const [cloudPasswordError, setCloudPasswordError] = useState(false);

  // States for Google Sheets connection
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleAuthToken, setGoogleAuthToken] = useState<string>("");
  const [isSyncingToSheets, setIsSyncingToSheets] = useState(false);
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem("sia_google_sheet_id") || "";
  });
  const [googleSpreadsheetUrl, setGoogleSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem("sia_google_sheet_url") || "";
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("sia_authenticated_v5") === "true";
  });
  const [loginPasswordInput, setLoginPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem("sia_audit_logs_v5");
    return saved ? JSON.parse(saved) : [
      {
        id: "initial-log",
        timestamp: new Date().toISOString(),
        action: "SISTEMA",
        description: "Se inicializó la Bitácora de Registro de Cambios de SIA CLOUD.",
        user: "danielconsultorsalud@gmail.com"
      }
    ];
  });

  const [decommissionedItems, setDecommissionedItems] = useState<any[]>(() => {
    const saved = localStorage.getItem("sia_decommissioned_v5");
    return saved ? JSON.parse(saved) : [];
  });

  // License popup & tooltip state
  const [selectedLicenseForPopup, setSelectedLicenseForPopup] = useState<License | null>(null);
  const [hoveredLicenseId, setHoveredLicenseId] = useState<string | null>(null);
  const [licenseTooltipPos, setLicenseTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tooltip Mouse State
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    id: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    id: "",
  });

  // Real-time server sync function
  const sendUpdate = async (field: string, value: any) => {
    try {
      await fetch("/api/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientIdRef.current,
        },
        body: JSON.stringify({ field, value }),
      });
    } catch (err) {
      console.error(`Failed to sync update for field ${field}:`, err);
    }
  };

  // Save Cloud Sync Key locally when updated
  useEffect(() => {
    if (cloudSyncId) {
      localStorage.setItem("sia_cloud_sync_id", cloudSyncId);
    } else {
      localStorage.removeItem("sia_cloud_sync_id");
    }
  }, [cloudSyncId]);

  // Helper to deep clean undefined values from objects before saving to Firestore
  const removeUndefined = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined);
    }
    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const val = obj[key];
          if (val !== undefined) {
            cleaned[key] = removeUndefined(val);
          }
        }
      }
      return cleaned;
    }
    return obj;
  };

  // Firestore cloud database sync helper
  const syncStateToCloudAPI = async (
    targetId: string,
    dbVal: any,
    compVal: any,
    areasVal: any,
    licsVal: any,
    invVal: any,
    logsVal: any,
    decVal: any
  ) => {
    if (!targetId) return;
    try {
      const payload = {
        database: dbVal,
        componentTypes: compVal,
        areas: areasVal,
        licenses: licsVal,
        inventoryItems: invVal,
        auditLogs: logsVal,
        decommissionedItems: decVal || [],
        googleSpreadsheetId,
        googleSpreadsheetUrl,
        updatedAt: new Date().toISOString(),
      };
      
      const docRef = doc(db, "sia_databases", targetId);
      await setDoc(docRef, removeUndefined(payload));
    } catch (err) {
      console.error("Failed to sync state to universal cloud Firestore:", err);
      throw err;
    }
  };

  // Immediate pull and sync function
  const handleSyncNow = async (targetId?: string) => {
    const activeId = targetId || cloudSyncId;
    if (!activeId) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, "sia_databases", activeId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        if (cloudData) {
          isIncomingUpdate.current = true;
          if (cloudData.database) setDatabase(cloudData.database);
          if (cloudData.componentTypes) setComponentTypes(cloudData.componentTypes);
          if (cloudData.areas) setAreas(cloudData.areas);
          if (cloudData.licenses) setLicenses(cloudData.licenses);
          if (cloudData.inventoryItems) setInventoryItems(cloudData.inventoryItems);
          if (cloudData.auditLogs) setAuditLogs(cloudData.auditLogs);
          if (cloudData.decommissionedItems) setDecommissionedItems(cloudData.decommissionedItems);
          if (cloudData.googleSpreadsheetId) {
            setGoogleSpreadsheetId(cloudData.googleSpreadsheetId);
            localStorage.setItem("sia_google_sheet_id", cloudData.googleSpreadsheetId);
          }
          if (cloudData.googleSpreadsheetUrl) {
            setGoogleSpreadsheetUrl(cloudData.googleSpreadsheetUrl);
            localStorage.setItem("sia_google_sheet_url", cloudData.googleSpreadsheetUrl);
          }
          setTimeout(() => {
            isIncomingUpdate.current = false;
          }, 200);
        }
      } else {
        // Not initialized yet in cloud, seed current browser state to the cloud
        await syncStateToCloudAPI(
          activeId,
          database,
          componentTypes,
          areas,
          licenses,
          inventoryItems,
          auditLogs,
          decommissionedItems
        );
      }
    } catch (err) {
      console.error("Failed to fetch cloud sync on demand from Firestore:", err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Explicit manual save to cloud function
  const handleSaveToCloud = async () => {
    if (!cloudSyncId) return;
    if (cloudPasswordInput !== "AdminCS") {
      setCloudPasswordError(true);
      return;
    }
    setCloudPasswordError(false);
    setIsSavingToCloud(true);
    try {
      const currentLogs = [...auditLogs];
      const newLog = {
        id: "save-log-" + Date.now(),
        timestamp: new Date().toISOString(),
        action: "SISTEMA",
        description: `Se guardaron y reemplazaron los datos manualmente en la Nube SIA (ID: ${cloudSyncId}).`,
        user: "danielconsultorsalud@gmail.com"
      };
      
      const updatedLogs = [newLog, ...currentLogs].slice(0, 500);
      setAuditLogs(updatedLogs);

      await syncStateToCloudAPI(
        cloudSyncId,
        database,
        componentTypes,
        areas,
        licenses,
        inventoryItems,
        updatedLogs,
        decommissionedItems
      );
      
      setIsSaveConfirmOpen(false);
      setCloudPasswordInput("");
      alert("¡Éxito! La base de datos ha sido guardada y sincronizada correctamente en la Nube SIA.");
    } catch (err: any) {
      console.error("Failed to save state to Cloud Firestore:", err);
      const errMsg = err?.message || String(err);
      alert(`Hubo un error al intentar guardar en la Nube SIA: ${errMsg}\nPor favor reintenta.`);
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleConnectAndSyncGoogleSheets = async () => {
    setIsSyncingToSheets(true);
    try {
      let token = googleAuthToken;
      let userObj = googleUser;
      
      // 1. If not authenticated, prompt login with popup
      if (!token) {
        const result = await loginWithGoogleSheets();
        if (result) {
          token = result.token;
          userObj = result.user;
          setGoogleAuthToken(token);
          setGoogleUser(userObj);
        } else {
          throw new Error("No se pudo iniciar sesión con Google.");
        }
      }

      // 2. Clear or create spreadsheet if not exists
      let sheetId = googleSpreadsheetId;
      let sheetUrl = googleSpreadsheetUrl;

      if (!sheetId) {
        const newSheet = await createInventorySpreadsheet(token, "SIA CLOUD - Inventario de Equipos y Licencias");
        sheetId = newSheet.id;
        sheetUrl = newSheet.url;
        setGoogleSpreadsheetId(sheetId);
        setGoogleSpreadsheetUrl(sheetUrl);
        localStorage.setItem("sia_google_sheet_id", sheetId);
        localStorage.setItem("sia_google_sheet_url", sheetUrl);
        
        // Push the update immediately to cloud so other users are linked
        try {
          await setDoc(doc(db, "sia_databases", cloudSyncId), removeUndefined({
            database,
            componentTypes,
            areas,
            licenses,
            inventoryItems,
            auditLogs,
            decommissionedItems,
            googleSpreadsheetId: sheetId,
            googleSpreadsheetUrl: sheetUrl,
            updatedAt: new Date().toISOString()
          }));
        } catch (dbErr) {
          console.warn("No se pudo actualizar el ID de Google Sheet en Firestore, pero se guardó de forma local:", dbErr);
        }
      }

      // 3. Write/Sync database to sheet organized by columns
      await syncDatabaseToGoogleSheet(token, sheetId, database, licenses);
      
      // Update audit log
      const currentLogs = [...auditLogs];
      const newLog = {
        id: "sheet-sync-log-" + Date.now(),
        timestamp: new Date().toISOString(),
        action: "GOOGLE_SHEETS",
        description: `Se exportó y sincronizó correctamente el inventario con Google Sheets (organizado en columnas).`,
        user: userObj?.email || "danielconsultorsalud@gmail.com"
      };
      setAuditLogs([newLog, ...currentLogs].slice(0, 500));
      
      alert("¡Éxito! Todo el inventario se ha sincronizado correctamente con Google Sheets (organizado en columnas).");
    } catch (err: any) {
      console.error("Google Sheets sync failed:", err);
      const errMsg = err?.message || String(err);
      
      // If unauthorized/expired token, reset auth token so they can re-login next click
      if (errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("token")) {
        setGoogleAuthToken("");
        setGoogleUser(null);
        alert("Tu sesión de Google Sheets ha expirado. Por favor, haz clic nuevamente para volver a conectar.");
      } else {
        alert(`Hubo un problema al sincronizar con Google Sheets:\n${errMsg}\nPor favor intenta nuevamente.`);
      }
    } finally {
      setIsSyncingToSheets(false);
    }
  };

  // Real-time Firestore synchronization and local event sourcing fallback
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;

    if (cloudSyncId) {
      // 1. Fetch once on mount or when cloudSyncId changes. The user requested manual pull/push.
      handleSyncNow(cloudSyncId);
    } else {
      // 2. Otherwise pull from local node server and fallback to local SSE
      async function initLocalSync() {
        try {
          const res = await fetch("/api/data");
          if (!res.ok) throw new Error("Server not responding");
          const serverData = await res.json();

          if (isMounted) {
            isIncomingUpdate.current = true;

            // If the server was never seeded/initialized, push the local localStorage template data
            if (!serverData.initialized) {
              const hasLocalData = localStorage.getItem("sia_master_v5") || localStorage.getItem("sia_licenses_v5");
              const seedPayload = {
                database: hasLocalData ? JSON.parse(localStorage.getItem("sia_master_v5") || "{}") : {},
                componentTypes: hasLocalData ? JSON.parse(localStorage.getItem("sia_component_types_v5") || "[]") : DEFAULT_COMPONENT_TYPES,
                areas: hasLocalData ? JSON.parse(localStorage.getItem("sia_areas_v5") || "[]") : DEFAULT_AREAS,
                licenses: hasLocalData ? JSON.parse(localStorage.getItem("sia_licenses_v5") || "[]") : [
                  { id: "lic-windows11", name: "Windows 11 Pro Enterprise", limit: 10 },
                  { id: "lic-office365", name: "Office 365 Business Premium", limit: 5 },
                ],
                inventoryItems: hasLocalData ? JSON.parse(localStorage.getItem("sia_inventory_v5") || "[]") : [
                  { id: "inv-board-1", name: "ASUS Prime H510M-E LGA1200", type: "board", quantity: 4, notes: "Cajas selladas - Estante A" },
                  { id: "inv-board-2", name: "Gigabyte B560M H Ultra", type: "board", quantity: 2, notes: "Caja principal estante A" },
                  { id: "inv-cpu-1", name: "Intel Core i5-11400 2.6GHz", type: "procesador", quantity: 6, notes: "Caja de procesadores" },
                  { id: "inv-cpu-2", name: "Intel Core i7-11700 3.6GHz", type: "procesador", quantity: 2, notes: "Gabinete de seguridad TI" },
                  { id: "inv-ram-1", name: "Kingston Fury Beast DDR4 8GB 3200MHz", type: "ram", quantity: 12, notes: "Cajón de repuestos RAM" },
                  { id: "inv-ram-2", name: "Corsair Vengeance LPX DDR4 16GB 3200Mhz", type: "ram", quantity: 8, notes: "Cajón de repuestos RAM" },
                  { id: "inv-ssd-1", name: "Crucial P3 NVMe M.2 SSD 500GB", type: "almacenamiento", quantity: 10, notes: "Estante seguro TI" },
                  { id: "inv-ssd-2", name: "Kingston A400 SATA SSD 480GB", type: "almacenamiento", quantity: 6, notes: "Cajón de repuestos SSD" },
                  { id: "inv-gpu-1", name: "NVIDIA GeForce GTX 1650 4GB", type: "video", quantity: 3, notes: "Rack de tarjetas gráficas" },
                  { id: "inv-3", name: "Monitor HP v22v FHD 21.5''", type: "monitor", quantity: 5, notes: "Rack de monitores" },
                  { id: "inv-1", name: "Mouse Logitech M170 Inalámbrico", type: "mouse", quantity: 5, notes: "Armario TI - Caja Principal" },
                  { id: "inv-2", name: "Teclado Redragon Dragonborn K630", type: "teclado", quantity: 3, notes: "Estante Auxiliar 2" },
                  { id: "inv-4", name: "Cámara Web Full HD Genius 1080p", type: "camara", quantity: 3, notes: "Soporte Técnico" },
                ],
                auditLogs: hasLocalData ? JSON.parse(localStorage.getItem("sia_audit_logs_v5") || "[]") : [
                  {
                    id: "initial-log",
                    timestamp: new Date().toISOString(),
                    action: "SISTEMA",
                    description: "Se inicializó la Bitácora de Registro de Cambios de SIA CLOUD.",
                    user: "danielconsultorsalud@gmail.com"
                  }
                ],
                decommissionedItems: hasLocalData ? JSON.parse(localStorage.getItem("sia_decommissioned_v5") || "[]") : []
              };

              await fetch("/api/seed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(seedPayload),
              });

              setDatabase(seedPayload.database);
              setComponentTypes(seedPayload.componentTypes);
              setAreas(seedPayload.areas);
              setLicenses(seedPayload.licenses);
              setInventoryItems(seedPayload.inventoryItems);
              setAuditLogs(seedPayload.auditLogs);
              setDecommissionedItems(seedPayload.decommissionedItems || []);
            } else {
              setDatabase(serverData.database || {});
              setComponentTypes(serverData.componentTypes || DEFAULT_COMPONENT_TYPES);
              setAreas(serverData.areas || DEFAULT_AREAS);
              setLicenses(serverData.licenses || []);
              setInventoryItems(serverData.inventoryItems || []);
              setAuditLogs(serverData.auditLogs || []);
              setDecommissionedItems(serverData.decommissionedItems || []);
            }
          }
        } catch (err) {
          console.error("Failed initial storage fetch from server:", err);
        } finally {
          if (isMounted) {
            setTimeout(() => {
              isIncomingUpdate.current = false;
            }, 150);
          }
        }
      }

      initLocalSync();

      try {
        eventSource = new EventSource(`/api/events?clientId=${clientIdRef.current}`);
        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.senderId !== clientIdRef.current) {
              isIncomingUpdate.current = true;
              
              if (parsed.field === "database") setDatabase(parsed.value);
              if (parsed.field === "componentTypes") setComponentTypes(parsed.value);
              if (parsed.field === "areas") setAreas(parsed.value);
              if (parsed.field === "licenses") setLicenses(parsed.value);
              if (parsed.field === "inventoryItems") setInventoryItems(parsed.value);
              if (parsed.field === "auditLogs") setAuditLogs(parsed.value);
              if (parsed.field === "decommissionedItems") setDecommissionedItems(parsed.value);

              setTimeout(() => {
                isIncomingUpdate.current = false;
              }, 150);
            }
          } catch (err) {
            console.error("SSE parsing error:", err);
          }
        };
      } catch (err) {
        console.error("Could not register SSE client:", err);
      }
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [cloudSyncId]);

  // Save changes to LocalStorage and server safely
  useEffect(() => {
    localStorage.setItem("sia_master_v5", JSON.stringify(database));
    if (!isIncomingUpdate.current) {
      sendUpdate("database", database);
    }
  }, [database]);

  useEffect(() => {
    localStorage.setItem("sia_areas_v5", JSON.stringify(areas));
    if (!isIncomingUpdate.current) {
      sendUpdate("areas", areas);
    }
  }, [areas]);

  useEffect(() => {
    localStorage.setItem("sia_licenses_v5", JSON.stringify(licenses));
    if (!isIncomingUpdate.current) {
      sendUpdate("licenses", licenses);
    }
  }, [licenses]);

  useEffect(() => {
    localStorage.setItem("sia_inventory_v5", JSON.stringify(inventoryItems));
    if (!isIncomingUpdate.current) {
      sendUpdate("inventoryItems", inventoryItems);
    }
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem("sia_component_types_v5", JSON.stringify(componentTypes));
    if (!isIncomingUpdate.current) {
      sendUpdate("componentTypes", componentTypes);
    }
  }, [componentTypes]);

  useEffect(() => {
    localStorage.setItem("sia_audit_logs_v5", JSON.stringify(auditLogs));
    if (!isIncomingUpdate.current) {
      sendUpdate("auditLogs", auditLogs);
    }
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem("sia_decommissioned_v5", JSON.stringify(decommissionedItems));
    if (!isIncomingUpdate.current) {
      sendUpdate("decommissionedItems", decommissionedItems);
    }
  }, [decommissionedItems]);

  // Logging engine inside state
  const logEvent = (action: string, description: string, user = "danielconsultorsalud@gmail.com") => {
    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      description,
      user,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const handleClearLogs = () => {
    const resetEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "SISTEMA",
      description: "El administrador vació el historial completo del registro de auditoría técnica.",
      user: "danielconsultorsalud@gmail.com"
    };
    setAuditLogs([resetEntry]);
  };

  const handleRestoreBackup = (backupData: {
    database: AppDatabase;
    componentTypes: ComponentType[];
    areas: Area[];
    licenses: License[];
    inventoryItems: InventoryItem[];
    auditLogs: AuditLogEntry[];
  }) => {
    setDatabase(backupData.database);
    setComponentTypes(backupData.componentTypes);
    setAreas(backupData.areas);
    setLicenses(backupData.licenses);
    setInventoryItems(backupData.inventoryItems);
    
    const restoreEvent: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: "SISTEMA",
      description: "Se restauró por completo la base de datos de SIA desde un archivo de respaldo JSON.",
      user: "danielconsultorsalud@gmail.com",
    };
    setAuditLogs([restoreEvent, ...(backupData.auditLogs || [])]);
  };


  // Handle Component Types Operations
  const handleAddComponentType = (name: string, icon: string) => {
    // Generate an ID based on sanitized name to prevent collisions but be readable
    const safeId = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const id = safeId || `custom-${Date.now()}`;
    
    // Check for duplicate ID
    if (componentTypes.some((t) => t.id === id)) {
      alert("Ya existe una clasificación con un nombre similar.");
      return;
    }

    setComponentTypes((prev) => [...prev, { id, name, icon }]);
    logEvent("CREAR_CATEGORIA", `Se añadió una nueva clasificación de hardware: "${icon} ${name}".`);
  };

  const handleUpdateComponentType = (id: string, name: string, icon: string) => {
    if (DEFAULT_COMPONENT_TYPES.some((t) => t.id === id)) {
      alert("No se puede modificar una clasificación del sistema por defecto.");
      return;
    }
    const old = componentTypes.find((t) => t.id === id);
    setComponentTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name, icon } : t))
    );
    logEvent("MODIFICAR_CATEGORIA", `Se actualizó la categoría de hardware de "${old?.icon} ${old?.name}" a "${icon} ${name}".`);
  };

  const handleDeleteComponentType = (id: string) => {
    if (DEFAULT_COMPONENT_TYPES.some((t) => t.id === id)) {
      alert("No se puede eliminar una clasificación del sistema por defecto.");
      return;
    }
    const old = componentTypes.find((t) => t.id === id);
    setComponentTypes((prev) => prev.filter((t) => t.id !== id));
    if (old) {
      logEvent("ELIMINAR_CATEGORIA", `Se eliminó la categoría de hardware "${old.icon} ${old.name}".`);
    }
  };

  // Handle Edit Desks
  const handleOpenAssetModal = (id: string, label: string) => {
    setSelectedPuesto({ id, label });
    setIsAssetModalOpen(true);
  };

  const handleCloseAssetModal = () => {
    setIsAssetModalOpen(false);
    setSelectedPuesto(null);
  };

  const handleSaveAsset = (puestoId: string, data: AssetData) => {
    const oldData = database[puestoId];
    let desc = `Se actualizó la configuración del puesto "${puestoId}" (${data.nombre_equipo || 'Sin nombre'}).`;
    if (!oldData || !oldData.nombre_equipo) {
      desc = `Se configuró el nuevo equipo "${data.nombre_equipo || 'Sin nombre'}" en el puesto "${puestoId}" asignado a "${data.asignado_a || 'Sin asignar'}".`;
    } else {
      if (oldData.asignado_a !== data.asignado_a) {
        desc += ` Asignación cambió de "${oldData.asignado_a || 'Sin asignar'}" a "${data.asignado_a || 'Sin asignar'}".`;
      }
    }
    setDatabase((prev) => ({
      ...prev,
      [puestoId]: data,
    }));
    logEvent("ACTUALIZAR_EQUIPO", desc);
    handleCloseAssetModal();
  };

  // Handle Area Operations
  const handleAddArea = (name: string, color: string) => {
    setAreas((prev) => [...prev, { name, color }]);
    logEvent("CREAR_AREA", `Se creó el área de organización "${name}" con color ${color}.`);
  };

  const handleRemoveArea = (index: number) => {
    const area = areas[index];
    setAreas((prev) => prev.filter((_, i) => i !== index));
    if (area) {
      logEvent("ELIMINAR_AREA", `Se eliminó el área de organización "${area.name}".`);
    }
  };

  const handleUpdateArea = (index: number, newName: string, newColor: string) => {
    const oldArea = areas[index];
    if (!oldArea) return;

    setAreas((prev) => {
      const copy = [...prev];
      copy[index] = { name: newName, color: newColor };
      return copy;
    });

    if (oldArea.name !== newName) {
      setDatabase((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((puestoId) => {
          if (updated[puestoId] && updated[puestoId].area_select === oldArea.name) {
            updated[puestoId] = {
              ...updated[puestoId],
              area_select: newName,
            };
          }
        });
        return updated;
      });
    }

    logEvent("ACTUALIZAR_AREA", `Se actualizó el área "${oldArea.name}" a "${newName}" con color ${newColor}.`);
  };

  // Handle License Operations
  const handleAddLicense = (name: string, limit: number) => {
    const newLic: License = {
      id: `lic-${Date.now()}`,
      name,
      limit,
    };
    setLicenses((prev) => [...prev, newLic]);
    logEvent("CREAR_LICENCIA", `Se registró la licencia de software "${name}" con un límite de ${limit} activaciones.`);
  };

  const handleRemoveLicense = (id: string) => {
    const lic = licenses.find((l) => l.id === id);
    setDatabase((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((puestoId) => {
        if (updated[puestoId]) {
          const currentIds = updated[puestoId].licencia_ids || (updated[puestoId].licencia_id ? [updated[puestoId].licencia_id] : []);
          if (currentIds.includes(id) || updated[puestoId].licencia_id === id) {
            const filteredIds = currentIds.filter(lid => lid !== id);
            updated[puestoId] = {
              ...updated[puestoId],
              licencia_ids: filteredIds,
              licencia_id: filteredIds[0] || "",
            };
          }
        }
      });
      return updated;
    });
    setLicenses((prev) => prev.filter((lic) => lic.id !== id));
    if (lic) {
      logEvent("ELIMINAR_LICENCIA", `Se eliminó la licencia de software "${lic.name}" y se removió de todos los puestos asociados.`);
    }
  };

  const handleUpdateLicenseName = (id: string, newName: string) => {
    const oldLic = licenses.find((l) => l.id === id);
    if (!oldLic) return;

    setLicenses((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: newName } : l))
    );

    logEvent("ACTUALIZAR_LICENCIA", `Se cambió el nombre de la licencia "${oldLic.name}" a "${newName}".`);
  };

  // Handle Inventory Operations
  const handleAddInventoryItem = (item: Omit<InventoryItem, "id">) => {
    const newItem: InventoryItem = {
      ...item,
      id: `inv-${Date.now()}`,
    };
    setInventoryItems((prev) => [...prev, newItem]);
    const matchedType = componentTypes.find((t) => t.id === item.type);
    logEvent("APORTAR_STOCK", `Se ingresaron ${item.quantity} unidades de "${item.name}" con clasificación "${matchedType?.name || item.type}" al almacén.`);
  };

  const handleUpdateInventoryItem = (updatedItem: InventoryItem) => {
    setInventoryItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
    const matchedType = componentTypes.find((t) => t.id === updatedItem.type);
    logEvent("MODIFICAR_STOCK", `Se actualizaron las propiedades del componente de inventario "${updatedItem.name}" (${matchedType?.name || updatedItem.type}) en el almacén.`);
  };

  const handleUpdateInventoryQuantity = (id: string, delta: number) => {
    let itemName = "";
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          itemName = item.name;
          const nextQty = item.quantity + delta;
          return { ...item, quantity: Math.max(1, nextQty) };
        }
        return item;
      })
    );
    if (itemName) {
      logEvent("MODIFICAR_STOCK", `Se ${delta > 0 ? "incrementó" : "redujo"} el stock de "${itemName}" en ${Math.abs(delta)} unidad(es).`);
    }
  };

  const handleDeleteInventoryItem = (id: string) => {
    const item = inventoryItems.find((i) => i.id === id);
    setInventoryItems((prev) => prev.filter((item) => item.id !== id));
    if (item) {
      logEvent("ELIMINAR_STOCK", `Se eliminó del catálogo el componente de inventario "${item.name}".`);
    }
  };

  const handleDecommissionItem = (itemId: string, qty: number, reason: string) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) return;

    setInventoryItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return { ...i, quantity: Math.max(0, i.quantity - qty) };
        }
        return i;
      })
    );

    const newItem = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      type: item.type,
      serial: item.serial || "",
      quantity: qty,
      reason,
      timestamp: new Date().toISOString(),
      originalWorkstation: "Almacén (Stock Libre)",
    };

    setDecommissionedItems((prev) => [newItem, ...prev]);

    logEvent(
      "BAJA_HARDWARE",
      `Se dio de baja ${qty} unidad(es) de "${item.name}" (${item.serial ? `S/N: ${item.serial}` : "Sin S/N"}) por motivo: ${reason}.`
    );
  };

  const handleRestoreDecommissionedItem = (decId: string) => {
    const decItem = decommissionedItems.find((i) => i.id === decId);
    if (!decItem) return;

    setDecommissionedItems((prev) => prev.filter((i) => i.id !== decId));

    setInventoryItems((prev) => {
      const existing = prev.find((i) => i.name === decItem.name && i.type === decItem.type && i.serial === decItem.serial);
      if (existing) {
        return prev.map((i) => {
          if (i.id === existing.id) {
            return { ...i, quantity: i.quantity + decItem.quantity };
          }
          return i;
        });
      } else {
        return [
          ...prev,
          {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            name: decItem.name,
            type: decItem.type,
            serial: decItem.serial || "",
            quantity: decItem.quantity,
            notes: "Restaurado desde Equipos Dados de Baja",
          },
        ];
      }
    });

    logEvent(
      "RESTAURAR_HARDWARE",
      `Se restauró e ingresó de nuevo ${decItem.quantity} unidad(es) de "${decItem.name}" al almacén general.`
    );
  };

  const handlePurgeDecommissionedEntry = (decId: string) => {
    const decItem = decommissionedItems.find((i) => i.id === decId);
    if (!decItem) return;
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el registro de baja del componente "${decItem.name}"? Esta acción borrará el registro histórico de este desecho de forma irreversible.`)) {
      setDecommissionedItems((prev) => prev.filter((i) => i.id !== decId));
      logEvent(
        "PURGA_BAJA",
        `Se eliminó de forma definitiva el registro de desecho del hardware "${decItem.name}" del historial de bajas.`
      );
    }
  };

  // Tooltip tracking
  const handleMouseEnterPuesto = (e: React.MouseEvent, id: string) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      id,
    });
  };

  const handleMouseLeavePuesto = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Helper to translate inventory item IDs back into readable names on tooltips/reports automatically
  const formatComponentValue = (val: string | undefined): string => {
    if (!val) return "";
    const invItem = inventoryItems.find((item) => item.id === val);
    return invItem ? invItem.name : val;
  };

  // Stats Counters
  const totalDesks = 25; // 4 mesa A + 6 mesa B + 6 mesa C + 2 carlos (Principal e IT) + 3 (17,18,19) + 1 juntas + 1 gerencia = 23 total de puestos en mapa
  const filledDesks = Object.values(database).filter((d: AssetData) => d && d.nombre_equipo).length;
  const freeDesks = Math.max(0, 23 - filledDesks);

  // CSV Report Generator
  const handleExportCSV = () => {
    const fields = [
      "Puesto",
      "Nombre Equipo",
      "Asignado a",
      "Area",
      "Board",
      "Video",
      "Procesador",
      "Ram 1",
      "Ram 2",
      "Ram 3",
      "Ram 4",
      "Alm 1",
      "Alm 2",
      "Alm 3",
      "Mon 1",
      "Mon 2",
      "Wifi",
      "Mouse",
      "Teclado",
      "Camara",
      "Auriculares",
      "Licencia Activa",
      "Comentarios",
    ];

    let csvContent = "\uFEFF" + fields.join(",") + "\n";

    Object.keys(database).forEach((id) => {
      const d = database[id];
      if (d) {
        const row = [
          id,
          d.nombre_equipo || "",
          d.asignado_a || "",
          d.area_select || "",
          formatComponentValue(d.board),
          formatComponentValue(d.video),
          formatComponentValue(d.procesador),
          formatComponentValue(d.ram1),
          formatComponentValue(d.ram2),
          formatComponentValue(d.ram3),
          formatComponentValue(d.ram4),
          formatComponentValue(d.alm1),
          formatComponentValue(d.alm2),
          formatComponentValue(d.alm3),
          formatComponentValue(d.mon1),
          formatComponentValue(d.mon2),
          formatComponentValue(d.wifi),
          formatComponentValue(d.mouse),
          formatComponentValue(d.teclado),
          formatComponentValue(d.camara),
          formatComponentValue(d.auriculares),
          (() => {
            const ids = d.licencia_ids || (d.licencia_id ? [d.licencia_id] : []);
            if (ids.length === 0) return "Ninguna";
            return ids.map((id) => licenses.find((l) => l.id === id)?.name || id).join(" / ");
          })(),
          d.comentarios || "",
        ].map((val) => `"${val.replace(/"/g, '""')}"`); // Escapar comillas

        csvContent += row.join(",") + "\n";
      }
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_SIA_${new Date().getFullYear()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get specs for Tooltip
  const hoveredAsset = database[tooltip.id];
  const hoveredLicenseName = (() => {
    if (!hoveredAsset) return undefined;
    const ids = hoveredAsset.licencia_ids || (hoveredAsset.licencia_id ? [hoveredAsset.licencia_id] : []);
    if (ids.length === 0) return undefined;
    return ids.map((id) => licenses.find((l) => l.id === id)?.name || id).join(", ");
  })();

  const handleLoginSubmit = () => {
    if (loginPasswordInput === "Consultorsalud1*") {
      setIsAuthenticated(true);
      sessionStorage.setItem("sia_authenticated_v5", "true");
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-950">
        <div className="bg-white border border-slate-200 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-fade-in relative overflow-hidden">
          
          {/* Subtle decorative color bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-red-700" />
          
          <div className="flex flex-col items-center text-center">
            {/* Professional emblem style */}
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-3xl flex items-center justify-center text-red-700 shadow-sm mb-6">
              <KeyRound size={32} />
            </div>

            <h2 className="text-xl font-black tracking-tight text-slate-900 font-sans mb-1">
              SIA CLOUD
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-8">
              INVENTARIO DE EQUIPOS Y LICENCIAS
            </p>

            <div className="w-full space-y-5">
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block">
                  Contraseña de Administrador
                </label>
                <input
                  type="password"
                  value={loginPasswordInput}
                  onChange={(e) => {
                    setLoginPasswordInput(e.target.value);
                    setLoginError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLoginSubmit();
                  }}
                  placeholder="Contraseña..."
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 text-xs rounded-xl focus:bg-white text-center font-bold outline-none focus:border-red-500 transition-all font-mono tracking-widest shadow-2xs"
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl">
                  <p className="text-[10px] text-rose-700 font-black text-center font-mono">
                    ⚠️ Contraseña incorrecta. Intenta de nuevo.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleLoginSubmit}
                className="w-full py-3.5 bg-red-700 hover:bg-red-650 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-red-700/10 hover:shadow-red-650/15"
              >
                <KeyRound size={14} /> Acceder al Sistema
              </button>
            </div>

            <div className="mt-8 text-[9px] text-slate-450 font-bold uppercase tracking-widest font-mono">
              © CONSULTORSALUD 2026
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 min-h-screen">
      {/* TOOLTIP DINÁMICO */}
      <Tooltip
        visible={tooltip.visible && !!hoveredAsset && !!hoveredAsset.nombre_equipo}
        x={tooltip.x}
        y={tooltip.y}
        title={hoveredAsset?.nombre_equipo || ""}
        user={hoveredAsset?.asignado_a || ""}
        cpu={formatComponentValue(hoveredAsset?.procesador)}
        ram={[hoveredAsset?.ram1, hoveredAsset?.ram2, hoveredAsset?.ram3, hoveredAsset?.ram4]
          .map((r) => formatComponentValue(r))
          .filter(Boolean)
          .join(" | ")}
        disk={[hoveredAsset?.alm1, hoveredAsset?.alm2, hoveredAsset?.alm3]
          .map((d) => formatComponentValue(d))
          .filter(Boolean)
          .join(" | ")}
        board={formatComponentValue(hoveredAsset?.board)}
        licenseName={hoveredLicenseName}
        comentarios={hoveredAsset?.comentarios}
      />

      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col xl:flex-row gap-6 xl:gap-0 justify-between items-start xl:items-center bg-white border border-slate-200 p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center justify-center shrink-0 bg-red-50 border border-red-100 text-red-700 font-black tracking-wider text-sm px-4 py-2.5 rounded-2xl shadow-xs font-mono select-none" id="logo-cs-it">
              CS IT
            </div>
            <div className="border-l-0 sm:border-l border-slate-200 sm:pl-5 py-0.5">
              <div className="flex items-center gap-3">
                <h1 className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 m-0 flex flex-col items-start leading-[1.15]">
                  <span>Inventario</span>
                  <span className="text-red-700 font-normal">Equipos y Licencias</span>
                </h1>
                
                {cloudSyncId ? (
                  <div className="flex flex-wrap items-center gap-2 select-none shrink-0">
                    <button
                      onClick={() => setIsBackupModalOpen(true)}
                      className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[9px] font-black uppercase font-mono tracking-wider flex items-center gap-1.5 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
                      title={`Sincronización en la Nube SIA activa (${cloudSyncId}). Clic para configurar.`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Nube: {cloudSyncId}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsBackupModalOpen(true)}
                    className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-750 rounded-lg text-[9px] font-black uppercase font-mono tracking-wider flex items-center gap-1.5 hover:bg-amber-100 transition-all cursor-pointer shadow-xs select-none shrink-0"
                    title="Almacenamiento Local temporal. Para sincronizar tus dispositivos en Netlify, haz clic aquí para activar la Nube SIA."
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Sin Nube
                  </button>
                )}
              </div>
              <p className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase mt-1.5 font-mono leading-none">
                Gestión de Activos TI
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto xl:justify-end">
            {/* Legend info panel */}
            <div className="hidden xl:flex items-center gap-5 py-2 px-4 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold font-mono shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 shadow-sm shadow-red-500/20" />
                <span className="text-slate-450 font-extrabold uppercase text-[9px]">Ocupados:</span>
                <span className="text-slate-900">{filledDesks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="text-slate-450 font-extrabold uppercase text-[9px]">Libres:</span>
                <span className="text-slate-900">{freeDesks}</span>
              </div>
            </div>

            {/* Grupo 1: Configuración */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setIsAreaManagerOpen(true)}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100/80 border border-slate-200/60 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <LayersIcon size={12} className="text-red-600" /> Áreas
              </button>

              <button
                onClick={() => setIsLicenseManagerOpen(true)}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100/80 border border-slate-200/60 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <KeyRound size={12} className="text-red-700" /> Licencias
              </button>

              <button
                onClick={() => setIsAuditLogModalOpen(true)}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100/80 border border-slate-200/60 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs relative"
              >
                <ClipboardList size={11} className="text-red-700" /> Logs
                {auditLogs.length > 0 && (
                  <span className="absolute -top-1.5 -right-1 bg-red-700 text-white rounded-full font-mono text-[8px] font-bold px-1.5 py-0.5 border border-white">
                    {auditLogs.length}
                  </span>
                )}
              </button>
            </div>

            {/* Grupo 2: Herramientas de Datos */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
              {cloudSyncId && (
                <>
                  <button
                    onClick={() => handleSyncNow()}
                    disabled={isSyncing}
                    className="flex-1 sm:flex-initial bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-700 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
                    title="Obtener el último estado guardado en la Nube SIA"
                  >
                    <RefreshCw size={11} className={`${isSyncing ? "animate-spin text-red-650" : "text-slate-500"}`} />
                    Refrescar
                  </button>

                  <button
                    onClick={() => {
                      setCloudPasswordInput("");
                      setCloudPasswordError(false);
                      setIsSaveConfirmOpen(true);
                    }}
                    disabled={isSavingToCloud}
                    className="flex-1 sm:flex-initial bg-red-700 hover:bg-red-650 text-white px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-red-700/10 disabled:opacity-60"
                    title="Reemplazar Master de la Nube con tus datos locales"
                  >
                    <CloudUpload size={11} className={isSavingToCloud ? "animate-bounce" : ""} />
                    {isSavingToCloud ? "Guardando..." : "Guardar en Nube"}
                  </button>
                </>
              )}

              <button
                onClick={() => setIsBackupModalOpen(true)}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100/80 border border-slate-200/60 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                title="Sincronización en la Nube y Copias"
              >
                <Database size={11} className="text-red-700" /> Nube
              </button>

              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-100/80 border border-slate-200/60 text-slate-700 hover:text-slate-900 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet size={12} className="text-emerald-700" /> CSV
              </button>

              <button
                onClick={handleConnectAndSyncGoogleSheets}
                disabled={isSyncingToSheets}
                className="flex-1 sm:flex-initial bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 text-emerald-850 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
                title={googleSpreadsheetUrl ? "Sincronizar datos con tu hoja de cálculo Google Sheets" : "Conectar con Google Sheets y crear hoja de cálculo"}
              >
                <FileSpreadsheet size={12} className={isSyncingToSheets ? "animate-spin text-emerald-600" : "text-emerald-700"} />
                {isSyncingToSheets ? "Sincronizando..." : googleSpreadsheetId ? "Sincronizar Sheets" : "Conectar Sheets"}
              </button>

              {googleSpreadsheetUrl && (
                <a
                  href={googleSpreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 border border-emerald-200 text-emerald-850 px-3.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  title="Abrir hoja de cálculo vinculada en una nueva pestaña"
                >
                  🟢 Abrir Excel/Sheet
                </a>
              )}

              <button
                onClick={() => generatePDFReport(database, componentTypes, licenses, inventoryItems)}
                className="flex-1 sm:flex-initial bg-red-700 hover:bg-red-600 text-white px-4.5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-red-700/10"
              >
                <FileDown size={12} className="text-white" /> PDF
              </button>
            </div>
          </div>
        </header>

        {/* LEYENDA AREA COLOR DEPARTAMENTAL */}
        <div className="bg-white border border-slate-200 p-5 rounded-[2rem] flex flex-wrap gap-4 items-center justify-center text-xs shadow-sm">
          <span className="text-slate-400 font-extrabold uppercase tracking-widest text-[9px] mr-2">
            Leyenda de Áreas:
          </span>
          {areas.length === 0 ? (
            <span className="text-slate-400 text-xs italic">Crea un área para categorizar los puestos</span>
          ) : (
            areas.map((area, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 px-3.5 rounded-xl border border-slate-100 font-sans">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: area.color,
                    boxShadow: `0 0 4px ${area.color}80`,
                  }}
                />
                <span className="text-slate-700 text-[11px] font-bold">{area.name}</span>
              </div>
            ))
          )}
        </div>

        {/* PANEL DE LICENCIAS DE SOFTWARE (VISUALIZACIÓN) */}
        <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 font-sans">
                <KeyRound size={16} className="text-red-700" />
                Resumen de Licencias de Software
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">
                Estado actual y cuotas de asignación en tiempo real
              </p>
            </div>
            <button
              onClick={() => setIsLicenseManagerOpen(true)}
              className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-100 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm font-sans"
            >
              <Plus size={11} /> Gestionar
            </button>
          </div>

          {licenses.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic font-medium bg-slate-50/55 rounded-2xl border border-slate-100">
              No tienes licencias registradas aún. Presiona "Gestionar" para crear tu primera licencia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {licenses.map((lic) => {
                const usedAssets = Object.entries(database).filter(([_, d]) => {
                  if (!d) return false;
                  const ids = (d as AssetData).licencia_ids || ((d as AssetData).licencia_id ? [(d as AssetData).licencia_id] : []);
                  return ids.includes(lic.id);
                }) as [string, AssetData][];

                const used = usedAssets.length;
                const free = Math.max(0, lic.limit - used);
                const percent = Math.min(100, Math.round((used / lic.limit) * 100));
                const isFull = used >= lic.limit;

                const getFriendlyNameLocal = (id: string, name?: string) => {
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
                    return `Puesto ${num} (${location})`;
                  }
                  return id;
                };

                const hoverTitle = used === 0
                  ? "Esta licencia no está asignada a ningún equipo."
                  : `Asignada a:\n` + usedAssets.map(([id, d]) => `- ${getFriendlyNameLocal(id, d.nombre_equipo)} [Responsable: ${d.asignado_a || "Sin asignar"}]`).join("\n");

                return (
                  <button
                    key={lic.id}
                    type="button"
                    onClick={() => setSelectedLicenseForPopup(lic)}
                    className="bg-slate-50 border border-slate-100/80 p-4 rounded-2xl flex flex-col justify-between hover:shadow-md hover:bg-slate-100/60 hover:border-slate-250 transition-all duration-200 cursor-pointer text-left w-full active:scale-98 group"
                    title="Hacer clic para ver el detalle de asignaciones de esta licencia"
                  >
                    <div className="w-full">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="font-extrabold text-xs text-slate-800 tracking-tight leading-snug line-clamp-2 group-hover:text-red-850">
                          {lic.name}
                        </span>
                        <span className={`text-[9px] font-black font-mono uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                          isFull 
                             ? "bg-rose-50 text-rose-600 border-rose-200" 
                             : "bg-emerald-50 text-emerald-600 border-emerald-200"
                        }`}>
                          {isFull ? "Completa / Límite" : `${free} Libre${free !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] font-bold font-mono text-slate-500 mt-2">
                        <span>Asignadas: {used}</span>
                        <span>Límite: {lic.limit}</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 w-full">
                      {/* Progress Bar Gage */}
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? "bg-rose-500" : percent > 80 ? "bg-amber-400" : "bg-red-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-black font-mono text-slate-400 uppercase tracking-widest pt-1">
                        <span>{percent}% en Uso</span>
                        <span className="text-red-700 font-extrabold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform duration-150">
                          🔍 Ver Quién
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CONTENIDO INTERACTIVO MAPA */}
        <main className="py-2">
          <div className="border-b border-slate-100 pb-3 mb-6">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 font-sans">
              <Monitor size={16} className="text-red-700" />
              Equipos Asignados y Oficinas (Mapa)
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mt-0.5">
              Selecciona cualquier puesto de la oficina para auditar o modificar sus asignaciones de hardware
            </p>
          </div>
          <OfficeMap
            database={database}
            areas={areas}
            onSelectPuesto={handleOpenAssetModal}
            onMouseEnterPuesto={handleMouseEnterPuesto}
            onMouseLeavePuesto={handleMouseLeavePuesto}
          />
        </main>

        {/* MODULO DE INVENTARIO */}
        <div className="border-t border-slate-200 pt-8">
          <InventoryModule
            items={inventoryItems}
            database={database}
            componentTypes={componentTypes}
            onAddItem={handleAddInventoryItem}
            onUpdateQuantity={handleUpdateInventoryQuantity}
            onDeleteItem={handleDeleteInventoryItem}
            onOpenComponentTypeManager={() => setIsComponentTypeManagerOpen(true)}
            onUpdateItem={handleUpdateInventoryItem}
            onDecommissionItem={handleDecommissionItem}
          />
        </div>

        {/* MODULO DE EQUIPOS DADOS DE BAJA */}
        <div className="border-t border-slate-200 pt-8">
          <DecommissionedModule
            items={decommissionedItems}
            componentTypes={componentTypes}
            onRestore={handleRestoreDecommissionedItem}
            onPurge={handlePurgeDecommissionedEntry}
          />
        </div>

        {/* SECCION AYUDA - FOOTER COMPLEMENTARIO */}
        <footer className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-slate-400 text-[11px] font-semibold font-mono gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <HelpCircle size={13} className="text-red-600" />
            <span>Pasa el cursor por encima de un puesto activo para ver una vista previa rápida de su ficha técnica.</span>
          </div>
          <div>
            <span className="text-slate-400">SIA CLOUD — Diseñado para ConsultorSalud © {new Date().getFullYear()}</span>
          </div>
        </footer>

      </div>

      {/* COMPONENTES MODAL */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={handleCloseAssetModal}
        puestoId={selectedPuesto?.id || ""}
        puestoLabel={selectedPuesto?.label || ""}
        assetData={selectedPuesto ? database[selectedPuesto.id] : undefined}
        areas={areas}
        licenses={licenses}
        database={database}
        inventoryItems={inventoryItems}
        componentTypes={componentTypes}
        onSave={handleSaveAsset}
        onOpenAreaManager={() => {
          setIsAreaManagerOpen(true);
        }}
        decommissionedItems={decommissionedItems}
        onDecommissionItem={handleDecommissionItem}
      />

      <AreaManagerModal
        isOpen={isAreaManagerOpen}
        onClose={() => setIsAreaManagerOpen(false)}
        areas={areas}
        onAddArea={handleAddArea}
        onRemoveArea={handleRemoveArea}
        onUpdateArea={handleUpdateArea}
      />

      <LicenseManagerModal
        isOpen={isLicenseManagerOpen}
        onClose={() => setIsLicenseManagerOpen(false)}
        licenses={licenses}
        onAddLicense={handleAddLicense}
        onRemoveLicense={handleRemoveLicense}
        onUpdateLicenseName={handleUpdateLicenseName}
        database={database}
      />

      <ComponentTypeManagerModal
        isOpen={isComponentTypeManagerOpen}
        onClose={() => setIsComponentTypeManagerOpen(false)}
        componentTypes={componentTypes}
        inventoryItems={inventoryItems}
        onAddComponentType={handleAddComponentType}
        onUpdateComponentType={handleUpdateComponentType}
        onDeleteComponentType={handleDeleteComponentType}
      />

      <AuditLogModal
        isOpen={isAuditLogModalOpen}
        onClose={() => setIsAuditLogModalOpen(false)}
        logs={auditLogs}
        onClearLogs={handleClearLogs}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        database={database}
        componentTypes={componentTypes}
        areas={areas}
        licenses={licenses}
        inventoryItems={inventoryItems}
        auditLogs={auditLogs}
        onRestoreBackup={handleRestoreBackup}
        cloudSyncId={cloudSyncId}
        onSetCloudSyncId={setCloudSyncId}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
      />

      {/* CONFIRMACIÓN MANUAL GUARDAR EN LA NUBE MODAL */}
      {isSaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-red-50 border-b border-red-100 p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-750 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} className="animate-pulse text-red-700" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950 font-sans tracking-tight">
                  Confirmación de Reemplazo en la Nube
                </h3>
                <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400 mt-1">
                  Acción irreversible de almacenamiento de datos
                </p>
              </div>
            </div>

            {/* Body content */}
            <div className="p-6 space-y-4 font-sans text-slate-600 text-xs leading-relaxed">
              <p>
                Estás a punto de sincronizar tu base de datos local y guardar los cambios actuales en la Nube SIA bajo el identificador activo:
              </p>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between font-mono">
                <span className="text-slate-400 text-[10px] uppercase font-black">Código de Enlace:</span>
                <span className="text-red-750 font-black text-sm tracking-wider">"{cloudSyncId}"</span>
              </div>
              <p className="text-rose-750 font-semibold flex items-start gap-2 bg-rose-50 border border-rose-100 p-3 rounded-xl leading-relaxed">
                <span className="text-base select-none mt-0.5">⚠️</span>
                <span>
                  <strong>¡ATENCIÓN!</strong> Al proceder, <strong>se reemplazará por completo</strong> toda la información que esté guardada en la nube con los datos que ves en tu pantalla actualmente. Ningún dato remoto anterior podrá recuperarse.
                </span>
              </p>

              {/* Password authorization form */}
              <div className="border-t border-slate-150 pt-4 space-y-1.5">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                  Contraseña de Administrador Requerida
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={cloudPasswordInput}
                    onChange={(e) => {
                      setCloudPasswordInput(e.target.value);
                      setCloudPasswordError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveToCloud();
                      }
                    }}
                    placeholder="Escribe la contraseña para guardar..."
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs rounded-xl focus:bg-white text-center font-bold outline-none focus:border-red-500 transition-all font-mono tracking-widest"
                    autoFocus
                  />
                </div>
                {cloudPasswordError && (
                  <p className="text-[10px] text-rose-600 font-black text-center font-mono mt-1">
                    ⚠️ Contraseña incorrecta. No se permite guardar.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 border-t border-slate-200/60 p-4 px-6 flex justify-end gap-3 font-sans">
              <button
                onClick={() => setIsSaveConfirmOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-extrabold uppercase rounded-xl tracking-wider cursor-pointer transition-all shadow-xs"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleSaveToCloud}
                disabled={isSavingToCloud}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-650 text-white text-[11px] font-extrabold uppercase rounded-xl tracking-wider cursor-pointer transition-all shadow-md shadow-red-700/10 flex items-center gap-2 disabled:opacity-60"
              >
                {isSavingToCloud ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CloudUpload size={12} />
                    Sí, Reemplazar todo en la Nube
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal interactivo de asignaciones de licencia */}
      {selectedLicenseForPopup && (() => {
        const lic = selectedLicenseForPopup;
        const usedAssets = Object.entries(database).filter(([_, d]) => {
          if (!d) return false;
          const ids = (d as AssetData).licencia_ids || ((d as AssetData).licencia_id ? [(d as AssetData).licencia_id] : []);
          return ids.includes(lic.id);
        }) as [string, AssetData][];

        const getFriendlyNameLocalForModal = (id: string, name?: string) => {
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
            return `Puesto ${num} (${location})`;
          }
          return id;
        };

        return (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-[200] p-4 font-sans text-slate-900 animate-fade-in">
            <div className="bg-white border border-slate-200 w-full max-w-xl rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[80vh] animate-scale-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-5 mb-4 border-dashed">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-150 text-red-800 rounded-xl flex items-center justify-center border border-red-200/50 shadow-xs shrink-0">
                    <KeyRound size={22} className="text-red-750" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950 text-base">Dispositivos con Licencia Activa</h3>
                    <p className="text-[10px] text-slate-450 font-sans font-extrabold uppercase tracking-wider mt-0.5 max-w-[280px] md:max-w-md truncate">
                      {lic.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLicenseForPopup(null)}
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 min-h-[150px]">
                {usedAssets.length === 0 ? (
                  <div className="text-center py-12 text-slate-450 text-xs italic font-semibold bg-slate-50/50 rounded-2.5xl border border-slate-100 flex flex-col items-center justify-center gap-3">
                    <KeyRound size={24} className="text-slate-350 animate-pulse" />
                    Esta licencia no se encuentra asignada actualmente a ningún equipo o puesto de trabajo.
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="py-2.5 px-4 text-[9px] font-extrabold text-slate-450 uppercase tracking-widest font-mono">Puesto / Equipo</th>
                          <th className="py-2.5 px-4 text-[9px] font-extrabold text-slate-450 uppercase tracking-widest font-mono">Responsable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usedAssets.map(([id, assetData], idx) => (
                          <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3 px-4">
                              <span className="text-xs font-bold text-slate-800 block leading-tight">
                                {getFriendlyNameLocalForModal(id, assetData.nombre_equipo)}
                              </span>
                              <span className="text-[9px] font-mono font-semibold text-slate-400">
                                ID: {id}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-black text-red-800 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                                {assetData.asignado_a || "Sin asignar"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-5 border-t border-slate-100 mt-4 border-dashed">
                <span className="text-[9px] font-mono font-bold text-slate-450">
                  Activaciones: {usedAssets.length} / {lic.limit} (Límite)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLicenseForPopup(null)}
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
}

// Custom simple inline component to display layer stack icon
function LayersIcon({ size = 16, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-10 5 10 5 10-5-10-5z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  );
}
