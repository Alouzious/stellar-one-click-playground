import React, { useState } from 'react';
import { formatErrorMessage, groupErrorsByFile, getErrorCounts } from '../utils/errorParser';
import './ErrorPanel.css';

export default function ErrorPanel({ errors, onErrorClick, onClose }) {
  const [filter, setFilter] = useState('all'); // 'all', 'errors', 'warnings', 'info'
  const [groupByFile, setGroupByFile] = useState(true);

  if (!errors || errors.length === 0) {
    return null;
  }

  const counts = getErrorCounts(errors);
  
  // Filter errors based on selected filter
  const filteredErrors = errors.filter(err => {
    if (filter === 'all') return true;
    if (filter === 'errors') return err.severity === 'error';
    if (filter === 'warnings') return err.severity === 'warning';
    if (filter === 'info') return err.severity === 'info';
    return true;
  });

  const groupedErrors = groupByFile ? groupErrorsByFile(filteredErrors) : { 'All': filteredErrors };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '●';
    }
  };

  const getSeverityClass = (severity) => {
    return `error-item-${severity}`;
  };

  return (
    <div className="error-panel">
      {/* Header */}
      <div className="error-panel-header">
        <div className="error-panel-title">
          <span className="error-panel-icon">🐛</span>
          <span>Problems</span>
          <span className="error-count-badge">
            {counts.error > 0 && <span className="error-badge">❌ {counts.error}</span>}
            {counts.warning > 0 && <span className="warning-badge">⚠️ {counts.warning}</span>}
            {counts.info > 0 && <span className="info-badge">ℹ️ {counts.info}</span>}
          </span>
        </div>
        
        <div className="error-panel-actions">
          {/* Filter buttons */}
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({errors.length})
          </button>
          <button
            className={`filter-btn ${filter === 'errors' ? 'active' : ''}`}
            onClick={() => setFilter('errors')}
            disabled={counts.error === 0}
          >
            Errors ({counts.error})
          </button>
          <button
            className={`filter-btn ${filter === 'warnings' ? 'active' : ''}`}
            onClick={() => setFilter('warnings')}
            disabled={counts.warning === 0}
          >
            Warnings ({counts.warning})
          </button>
          
          {/* Group toggle */}
          <button
            className="icon-btn"
            onClick={() => setGroupByFile(!groupByFile)}
            title={groupByFile ? 'Ungroup by file' : 'Group by file'}
          >
            {groupByFile ? '📂' : '📄'}
          </button>
          
          {/* Close button */}
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Error List */}
      <div className="error-panel-content">
        {Object.keys(groupedErrors).length === 0 ? (
          <div className="no-errors">
            <span className="no-errors-icon">✅</span>
            <p>No {filter !== 'all' ? filter : 'problems'} found</p>
          </div>
        ) : (
          Object.entries(groupedErrors).map(([file, fileErrors]) => (
            <div key={file} className="error-file-group">
              {groupByFile && file !== 'All' && (
                <div className="error-file-header">
                  📄 {file} ({fileErrors.length})
                </div>
              )}
              
              {fileErrors.map((error, index) => (
                <div
                  key={`${file}-${index}`}
                  className={`error-item ${getSeverityClass(error.severity)}`}
                  onClick={() => onErrorClick(error)}
                >
                  <span className="error-icon">
                    {getSeverityIcon(error.severity)}
                  </span>
                  
                  <div className="error-content">
                    <div className="error-message">
                      {formatErrorMessage(error)}
                    </div>
                    <div className="error-location">
                      {error.file && `${error.file.split('/').pop()}:`}
                      {error.line}:{error.column}
                    </div>
                  </div>
                  
                  <span className="error-goto">→</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}