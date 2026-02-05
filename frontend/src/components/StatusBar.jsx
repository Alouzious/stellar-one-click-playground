import React, { useState, useEffect } from 'react';
import './StatusBar.css';

export default function StatusBar({ 
  file, 
  isSaving = false,
  lastSaved = null,
  isOnline = true,
  cursorPosition = { line: 1, column: 1 },
  isLinting = false,
  errorCount = 0,
  warningCount = 0
}) {
  const [fileSize, setFileSize] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (file?.content) {
      const content = file.content;
      const lines = content.split('\n');
      
      setLineCount(lines.length);
      setCharCount(content.length);
      setFileSize(new Blob([content]).size);
    } else {
      setLineCount(0);
      setCharCount(0);
      setFileSize(0);
    }
  }, [file]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatLastSaved = (timestamp) => {
    if (!timestamp) return 'Never saved';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {isSaving && (
          <div className="status-item status-saving">
            <span className="status-spinner">⏳</span>
            <span>Saving...</span>
          </div>
        )}
        
        {isLinting && (
          <div className="status-item status-linting">
            <span className="status-spinner">🔍</span>
            <span>Checking...</span>
          </div>
        )}
        
        {!isSaving && lastSaved && (
          <div className="status-item">
            <span>💾</span>
            <span>{formatLastSaved(lastSaved)}</span>
          </div>
        )}
        
        <div className={`status-item ${isOnline ? 'status-online' : 'status-offline'}`}>
          <span className="status-dot" />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="status-bar-right">
        {(errorCount > 0 || warningCount > 0) && (
          <div className="status-item status-diagnostics">
            {errorCount > 0 && (
              <span className="diagnostic-count error-count">
                ❌ {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="diagnostic-count warning-count">
                ⚠️ {warningCount}
              </span>
            )}
          </div>
        )}
        
        {file && (
          <>
            <div className="status-item" title="File size">
              <span>📦</span>
              <span>{formatFileSize(fileSize)}</span>
            </div>
            
            <div className="status-item" title="Lines">
              <span>📄</span>
              <span>{lineCount} lines</span>
            </div>
            
            <div className="status-item" title="Characters">
              <span>✍️</span>
              <span>{charCount.toLocaleString()} chars</span>
            </div>
            
            <div className="status-item" title="Cursor position">
              <span>📍</span>
              <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            </div>
            
            <div className="status-item" title="Language">
              <span>
                {file.language === 'rust' ? '🦀' : 
                 file.language === 'toml' ? '📦' : 
                 file.language === 'markdown' ? '📝' : '📄'}
              </span>
              <span>{file.language.toUpperCase()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}