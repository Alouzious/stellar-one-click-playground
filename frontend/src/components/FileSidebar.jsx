import React, { useState, memo } from "react";
import "./FileSidebar.css";

// Professional File Icons (VS Code style)
const FileIcons = {
  // Language-specific icons
  rust: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L2 4.5V11.5L8 15L14 11.5V4.5L8 1Z" fill="#CE422B"/>
      <circle cx="8" cy="8" r="2.5" fill="#fff"/>
      <path d="M8 5.5V10.5M5.5 8H10.5" stroke="#CE422B" strokeWidth="0.8"/>
    </svg>
  ),
  
  toml: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="#9CDCFE"/>
      <path d="M5 5h6M5 7h6M5 9h4" stroke="#1E1E1E" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  
  markdown: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="12" height="8" rx="1" fill="#42A5F5"/>
      <path d="M4 9L5.5 7L7 9V6M9 9L10.5 7L12 9V6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  json: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="#FFCA28"/>
      <path d="M6 6V7.5C6 8 5.5 8 5.5 8.5C5.5 9 6 9 6 9.5V11" stroke="#1E1E1E" strokeWidth="1" fill="none"/>
      <path d="M10 6V7.5C10 8 10.5 8 10.5 8.5C10.5 9 10 9 10 9.5V11" stroke="#1E1E1E" strokeWidth="1" fill="none"/>
    </svg>
  ),
  
  shell: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="12" height="10" rx="1" fill="#4EC9B0"/>
      <path d="M4 6L6 8L4 10M7 10H10" stroke="#1E1E1E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  text: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1" fill="#CCCCCC"/>
      <path d="M5 5h6M5 7h6M5 9h4" stroke="#1E1E1E" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  
  // Folder icons
  folderClosed: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5C1 2.67 1.67 2 2.5 2H5.5L7 4H13.5C14.33 4 15 4.67 15 5.5V12.5C15 13.33 14.33 14 13.5 14H2.5C1.67 14 1 13.33 1 12.5V3.5Z" fill="#C09553"/>
    </svg>
  ),
  
  folderOpen: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5C1 2.67 1.67 2 2.5 2H5.5L7 4H13.5C14.33 4 15 4.67 15 5.5V12.5C15 13.33 14.33 14 13.5 14H2.5C1.67 14 1 13.33 1 12.5V3.5Z" fill="#DCBF85"/>
      <path d="M1 6H15V12.5C15 13.33 14.33 14 13.5 14H2.5C1.67 14 1 13.33 1 12.5V6Z" fill="#C09553" fillOpacity="0.5"/>
    </svg>
  ),
  
  // Action icons
  newFile: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  
  edit: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  delete: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4H13M5 4V3C5 2.5 5.5 2 6 2H10C10.5 2 11 2.5 11 3V4M6 7V11M10 7V11M4 4L4.5 13C4.5 13.5 5 14 5.5 14H10.5C11 14 11.5 13.5 11.5 13L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  chevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  chevronDown: () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// Get icon based on file extension
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'rs':
      return <FileIcons.rust />;
    case 'toml':
      return <FileIcons.toml />;
    case 'md':
      return <FileIcons.markdown />;
    case 'json':
      return <FileIcons.json />;
    case 'sh':
      return <FileIcons.shell />;
    default:
      return <FileIcons.text />;
  }
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Memoized File Item component
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
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      title={lastSaved ? `Last saved: ${formatTimestamp(lastSaved)}` : ""}
    >
      <div className="file-item-left">
        <span className="file-item-icon">
          {getFileIcon(file.name)}
        </span>
        <span className="file-item-name">{file.name}</span>
      </div>
      
      <div className="file-item-right">
        {/* Status indicator */}
        <div className="file-item-status">
          {isSaving && (
            <div className="status-indicator saving" title="Saving...">
              <div className="spinner"></div>
            </div>
          )}
          {!isSaving && isSaved && (
            <div className="status-indicator saved" title="Saved">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L6 11L13 4" stroke="#73C991" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          {isError && (
            <div className="status-indicator error" title="Error saving">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#F48771" strokeWidth="2"/>
                <path d="M8 5V9M8 11V11.5" stroke="#F48771" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="file-item-actions">
          <button
            className="file-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProtected && !isRenaming) {
                onRename();
              }
            }}
            disabled={isProtected || isRenaming}
            title={isProtected ? "Protected file" : "Rename"}
          >
            <FileIcons.edit />
          </button>
          
          <button
            className="file-action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              if (!isProtected && !isDeleting) {
                onDelete();
              }
            }}
            disabled={isProtected || isDeleting}
            title={isProtected ? "Protected file" : "Delete"}
          >
            <FileIcons.delete />
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
        className={`folder-header ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="folder-chevron">
          {isOpen ? <FileIcons.chevronDown /> : <FileIcons.chevronRight />}
        </span>
        <span className="folder-icon">
          {isOpen ? <FileIcons.folderOpen /> : <FileIcons.folderClosed />}
        </span>
        <span className="folder-name">{name}</span>
        <span className="folder-badge">{files.length}</span>
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
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4L8 1L14 4M2 4V12L8 15M2 4L8 7M14 4V12L8 15M14 4L8 7M8 7V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>EXPLORER</span>
        </div>
        <button
          className="sidebar-new-btn"
          onClick={onNewFile}
          disabled={isCreatingFile}
          title="New File (Ctrl+N)"
        >
          <FileIcons.newFile />
        </button>
      </div>

      {/* File Tree */}
      <div className="sidebar-tree">
        {files.length === 0 ? (
          <div className="sidebar-empty">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="12" y="16" width="40" height="32" rx="2" stroke="#3E3E42" strokeWidth="2" fill="none"/>
              <path d="M32 28V40M26 34H38" stroke="#3E3E42" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="empty-title">No files yet</p>
            <p className="empty-subtitle">Click + to create your first file</p>
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