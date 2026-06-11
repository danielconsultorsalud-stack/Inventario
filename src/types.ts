export interface Area {
  name: string;
  color: string;
}

export interface License {
  id: string;
  name: string;
  limit: number; // Cantidad máxima de equipos permitidos
}

export interface ComponentType {
  id: string;
  name: string;
  icon: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  serial?: string;
  notes?: string;
}

export interface AssetData {
  nombre_equipo?: string;
  asignado_a?: string;
  area_select?: string;
  board?: string;
  video?: string;
  procesador?: string;
  ram1?: string;
  ram2?: string;
  ram3?: string;
  ram4?: string;
  alm1?: string;
  alm2?: string;
  alm3?: string;
  alm4?: string;
  otros?: string;
  mon1?: string;
  mon2?: string;
  wifi?: string;
  mouse?: string;
  teclado?: string;
  camara?: string;
  auriculares?: string;
  licencia_id?: string; // ID de la licencia vinculada
  licencia_ids?: string[]; // IDs de las licencias vinculadas
  comentarios?: string; // Comentarios / observaciones adicionales
  [key: string]: string | string[] | undefined; // Permite indexación flexible por campo
}

export interface Database {
  [puestoId: string]: AssetData;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  user: string;
}

export interface DecommissionedItem {
  id: string;
  name: string;
  type: string;
  serial?: string;
  quantity: number;
  reason: string;
  timestamp: string;
  originalWorkstation?: string;
}


