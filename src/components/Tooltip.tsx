import React from "react";

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  user: string;
  cpu: string;
  ram: string;
  disk: string;
  board: string;
  licenseName?: string;
  comentarios?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  visible,
  x,
  y,
  title,
  user,
  cpu,
  ram,
  disk,
  board,
  licenseName,
  comentarios,
}) => {
  if (!visible) return null;

  return (
    <div
      className="bg-white border border-slate-200 shadow-xl p-4 rounded-xl min-w-[220px] fixed pointer-events-none z-[100] transition-all duration-75 text-xs text-slate-700"
      style={{
        left: `${x + 15}px`,
        top: `${y + 15}px`,
      }}
    >
      <div className="font-bold text-red-700 mb-1.5 border-b border-slate-100 pb-1.5 uppercase tracking-wider text-[11px] font-mono">
        {title}
      </div>
      <div className="text-slate-900 font-semibold mb-2.5 flex items-center gap-1.5">
        <span role="img" aria-label="user">👤</span> {user || "Sin asignar"}
      </div>
      <div className="text-slate-500 space-y-1 text-[10px]">
        <div>• CPU: <span className="text-slate-800 font-medium">{cpu || "-"}</span></div>
        <div>• RAM: <span className="text-slate-800 font-medium">{ram || "-"}</span></div>
        <div>• DISCO: <span className="text-slate-800 font-medium">{disk || "-"}</span></div>
        <div>• BOARD: <span className="text-slate-800 font-medium">{board || "-"}</span></div>
        {licenseName && (
          <div className="mt-2 pt-1.5 border-t border-dashed border-slate-200 flex items-center gap-1">
            <span role="img" aria-label="key">🔑</span>
            <span className="text-red-800 font-extrabold bg-red-50 border border-red-100 px-1.5 py-0.5 rounded text-[9px] font-mono max-w-[170px] truncate" title={licenseName}>
              {licenseName}
            </span>
          </div>
        )}
        {comentarios && (
          <div className="mt-2 pt-1.5 border-t border-dashed border-slate-200 text-slate-650 italic leading-normal max-w-[200px] break-words">
            📝 <span className="font-semibold text-slate-800">Comentarios:</span> {comentarios}
          </div>
        )}
      </div>
    </div>
  );
};
