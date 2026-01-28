import React, { useState, memo } from "react";
import { getFileIcon, formatTimestamp } from "../utils/fileUtils";
import "./FileSidebar.css";

// Memoized File Item component for better performance
const FileItem = memo(({
  file,
  isActive,
  onClick,
  onRename,
  onDelete,
  isSaving,
  isSaved,
  isError,
  lastSaved,
  isProtected,
  isRenaming,
  isDeleting,
  depth = 0
}) => {
  return (
    <div
      className={`file-item ${isActive ? "active" : ""} ${isDeleting ? "deleting" : ""}`}
      onClick={onClick}
      style={{ paddingLeft: `${depth * 16 + 12}px` }}
      title={lastSaved ? `Last saved: ${formatTimestamp(lastSaved)}` : ""}
    >
      <div className="file-left">
        <span className="file-icon">{getFileIcon(file.name)}</span>
        <span className="file-name">{file.name}</span>
      </div>
      
      <div className="file-right">
        <div className="file-status">
          {isSaving && (
            <span className="status-dot saving" title="Saving...">●</span>
          )}
          {!isSaving && isSaved && (
            <span className="status-dot saved" title="Saved">✓</span>
          )}
          {isError && (
            <span className="status-dot error" title="Error saving">!</span>
          )}
        </div>
        
        <div className="file-actions">
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProtected && !isRenaming) {
                onRename();
              } else if (isProtected) {
                alert("This file is protected and cannot be renamed.");
              }
            }}
            disabled={isProtected || isRenaming}
            title={isProtected ? "Protected file" : isRenaming ? "Renaming..." : "Rename"}
          >
            {isRenaming ? "⏳" : "✏️"}
          </button>
          
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProtected && !isDeleting) {
                onDelete();
              } else if (isProtected) {
                alert("This file is protected and cannot be deleted.");
              }
            }}
            disabled={isProtected || isDeleting}
            title={isProtected ? "Protected file" : isDeleting ? "Deleting..." : "Delete"}
          >
            {isDeleting ? "⏳" : "🗑️"}
          </button>
        </div>
      </div>
    </div>
  );
});

FileItem.displayName = "FileItem";

// Memoized Folder component
const FolderItem = memo(({
  name,
  files,
  activePath,
  setActivePath,
  onDeleteFile,
  onRenameFile,
  savingMap,
  savedMap,
  lastSavedMap,
  errorMap,
  protectedPaths,
  isDeletingFile,
  isRenamingFile,
  depth = 0
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="folder-item">
      <div
        className="folder-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="folder-arrow">{isOpen ? "▼" : "▶"}</span>
        <span className="folder-icon">📁</span>
        <span className="folder-name">{name}</span>
        <span className="folder-count">{files.length}</span>
      </div>
      
      {isOpen && (
        <div className="folder-contents">
          {files.map((f) => {
            const key = f.id || f.path;
            const isSaving = !!savingMap[key];
            const isSaved = !!savedMap[key] || !!lastSavedMap[key];
            const isError = !!errorMap[key];
            const lastSaved = lastSavedMap[key];
            const isProtected = protectedPaths.has(f.path);
            const isActive = activePath === f.path;
            const isDeleting = isDeletingFile === f.path;
            const isRenaming = isRenamingFile === f.path;

            return (
              <FileItem
                key={f.path}
                file={f}
                isActive={isActive}
                onClick={() => setActivePath(f.path)}
                onRename={() => onRenameFile(f.path)}
                onDelete={() => onDeleteFile(f.path)}
                isSaving={isSaving}
                isSaved={isSaved}
                isError={isError}
                lastSaved={lastSaved}
                isProtected={isProtected}
                isRenaming={isRenaming}
                isDeleting={isDeleting}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

FolderItem.displayName = "FolderItem";

export default function FileSidebar({
  files,
  activePath,
  setActivePath,
  onNewFile,
  onDeleteFile,
  onRenameFile,
  savingMap = {},
  savedMap = {},
  lastSavedMap = {},
  errorMap = {},
  protectedPaths = new Set(),
  isCreatingFile = false,
  isDeletingFile = null,
  isRenamingFile = null,
}) {
  // Build folder structure
  const structure = {
    root: [],
    contract: [],
    tests: [],
    scripts: [],
  };

  files.forEach((f) => {
    const parts = f.path.split("/").filter(Boolean);

    if (parts.length === 1) {
      structure.root.push(f);
    } else if (parts[0] === "contract") {
      structure.contract.push(f);
    } else if (parts[0] === "tests") {
      structure.tests.push(f);
    } else if (parts[0] === "scripts") {
      structure.scripts.push(f);
    } else {
      structure.root.push(f);
    }
  });

  // Sort files within each folder
  Object.keys(structure).forEach((key) => {
    structure[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="project-icon">📁</span>
          <span>FILE EXPLORER</span>
        </div>
        <button
          className="new-file-btn"
          onClick={onNewFile}
          disabled={isCreatingFile}
          title={isCreatingFile ? "Creating file..." : "New File (Ctrl+N)"}
        >
          {isCreatingFile ? "⏳" : "+"}
        </button>
      </div>

      <div className="file-tree">
        {files.length === 0 ? (
          <div className="empty-state">
            <p>No files yet</p>
            <p>Click + to create your first file</p>
          </div>
        ) : (
          <>
            {/* Root files */}
            {structure.root.length > 0 && (
              <div className="root-files">
                {structure.root.map((f) => {
                  const key = f.id || f.path;
                  const isSaving = !!savingMap[key];
                  const isSaved = !!savedMap[key] || !!lastSavedMap[key];
                  const isError = !!errorMap[key];
                  const lastSaved = lastSavedMap[key];
                  const isProtected = protectedPaths.has(f.path);
                  const isActive = activePath === f.path;
                  const isDeleting = isDeletingFile === f.path;
                  const isRenaming = isRenamingFile === f.path;

                  return (
                    <FileItem
                      key={f.path}
                      file={f}
                      isActive={isActive}
                      onClick={() => setActivePath(f.path)}
                      onRename={() => onRenameFile(f.path)}
                      onDelete={() => onDeleteFile(f.path)}
                      isSaving={isSaving}
                      isSaved={isSaved}
                      isError={isError}
                      lastSaved={lastSaved}
                      isProtected={isProtected}
                      isRenaming={isRenaming}
                      isDeleting={isDeleting}
                      depth={0}
                    />
                  );
                })}
              </div>
            )}

            {/* Contract folder */}
            {structure.contract.length > 0 && (
              <FolderItem
                name="contract"
                files={structure.contract}
                activePath={activePath}
                setActivePath={setActivePath}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                savingMap={savingMap}
                savedMap={savedMap}
                lastSavedMap={lastSavedMap}
                errorMap={errorMap}
                protectedPaths={protectedPaths}
                isDeletingFile={isDeletingFile}
                isRenamingFile={isRenamingFile}
                depth={0}
              />
            )}

            {/* Tests folder */}
            {structure.tests.length > 0 && (
              <FolderItem
                name="tests"
                files={structure.tests}
                activePath={activePath}
                setActivePath={setActivePath}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                savingMap={savingMap}
                savedMap={savedMap}
                lastSavedMap={lastSavedMap}
                errorMap={errorMap}
                protectedPaths={protectedPaths}
                isDeletingFile={isDeletingFile}
                isRenamingFile={isRenamingFile}
                depth={0}
              />
            )}

            {/* Scripts folder */}
            {structure.scripts.length > 0 && (
              <FolderItem
                name="scripts"
                files={structure.scripts}
                activePath={activePath}
                setActivePath={setActivePath}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                savingMap={savingMap}
                savedMap={savedMap}
                lastSavedMap={lastSavedMap}
                errorMap={errorMap}
                protectedPaths={protectedPaths}
                isDeletingFile={isDeletingFile}
                isRenamingFile={isRenamingFile}
                depth={0}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}