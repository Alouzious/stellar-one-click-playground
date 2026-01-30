import React, { useEffect, useRef } from "react";
import "./Terminal.css";

export default function Terminal({ logs = [], isOpen, onClose, onClear }) {
  const terminalRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">
          <span>🖥️</span>
          <span>Terminal</span>
        </div>
        <div className="terminal-actions">
          <button
            className="terminal-btn"
            onClick={onClear}
            title="Clear terminal"
            disabled={logs.length === 0}
          >
            🗑️ Clear
          </button>
          <button
            className="terminal-btn"
            onClick={onClose}
            title="Close terminal"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="terminal-body" ref={terminalRef}>
        {logs.length === 0 ? (
          <div className="terminal-empty">
            <p>Terminal is ready</p>
            <p>Build, test, or deploy to see output here</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`terminal-line ${log.type || ""}`}
            >
              <span className="terminal-timestamp">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              <span className="terminal-prefix">{log.prefix || ">"}</span>
              <span className="terminal-text">{log.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}