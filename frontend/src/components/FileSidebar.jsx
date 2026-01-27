import React from "react";
import "./FileSidebar.css";

const getIcon = (fileName) => {
  if (fileName.endsWith(".rs")) return "🦀";
  if (fileName.endsWith(".toml")) return "📦";
  if (fileName.endsWith(".md")) return "📖";
  if (fileName.endsWith(".json")) return "🟦";
  return "📄";
};

export default function FileSidebar({
  files,
  activePath,
  setActivePath,
  onNewFile,
  onDeleteFile,
  onRenameFile,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-title">
        📁 Project
        <button className="new-file-btn" onClick={onNewFile} title="New File">＋</button>
      </div>
      <ul className="file-list">
        {files.map((f) => (
          <li
            key={f.path}
            className={`file-item ${f.path === activePath ? 'selected' : ''}`}
            onClick={() => setActivePath(f.path)}
          >
            <span className="file-icon">{getIcon(f.name)}</span>
            {f.name}
            {/* Only show delete/rename if there's more than one file */}
            {files.length > 1 && (
              <>
                <button title="Rename" className="action-btn" onClick={e => {
                  e.stopPropagation(); onRenameFile(f.path);
                }}>✏️</button>
                <button title="Delete" className="action-btn" onClick={e => {
                  e.stopPropagation(); onDeleteFile(f.path);
                }}>🗑️</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}