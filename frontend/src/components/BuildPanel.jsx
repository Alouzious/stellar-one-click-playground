import React, { useState } from "react";
import "./BuildPanel.css";

export default function BuildPanel({ 
  projectId, 
  onBuild, 
  onTest, 
  onDeploy,
  onOpenTerminal,
  isBuilding = false,
  isTesting = false,
  isDeploying = false,
  lastBuildStatus = null,
  hasTerminalLogs = false
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="build-panel">
      <div className="build-actions">
        <button
          className="build-btn build"
          onClick={onBuild}
          disabled={isBuilding || isTesting || isDeploying}
          title="Build contract (Ctrl+B)"
        >
          {isBuilding ? (
            <>
              <span className="spinner">⏳</span>
              <span>Building...</span>
            </>
          ) : (
            <>
              <span>🔨</span>
              <span>Build</span>
            </>
          )}
        </button>

        <button
          className="build-btn test"
          onClick={onTest}
          disabled={isBuilding || isTesting || isDeploying}
          title="Run tests (Ctrl+T)"
        >
          {isTesting ? (
            <>
              <span className="spinner">⏳</span>
              <span>Testing...</span>
            </>
          ) : (
            <>
              <span>🧪</span>
              <span>Test</span>
            </>
          )}
        </button>

        <button
          className="build-btn deploy"
          onClick={onDeploy}
          disabled={isBuilding || isTesting || isDeploying || !lastBuildStatus?.success}
          title={
            !lastBuildStatus?.success 
              ? "Build successfully first to deploy" 
              : "Deploy to Stellar testnet"
          }
        >
          {isDeploying ? (
            <>
              <span className="spinner">⏳</span>
              <span>Deploying...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Deploy</span>
            </>
          )}
        </button>

        <button
          className="build-btn terminal"
          onClick={onOpenTerminal}
          title="Open terminal"
        >
          <span>🖥️</span>
          <span>Terminal</span>
          {hasTerminalLogs && <span className="terminal-badge">●</span>}
        </button>
      </div>

      {lastBuildStatus && (
        <div className={`build-status ${lastBuildStatus.success ? 'success' : 'error'}`}>
          <span className="status-icon">
            {lastBuildStatus.success ? '✓' : '✗'}
          </span>
          <span className="status-text">
            {lastBuildStatus.success 
              ? `Build successful • ${lastBuildStatus.size || 'N/A'}` 
              : 'Build failed'}
          </span>
          {lastBuildStatus.success && lastBuildStatus.wasmBase64 && (
            <button
              className="download-wasm-btn"
              onClick={() => downloadWasm(lastBuildStatus.wasmBase64, 'contract.wasm')}
              title="Download WASM file"
            >
              ⬇️ Download WASM
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function downloadWasm(base64Data, filename) {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and download
    const blob = new Blob([bytes], { type: 'application/wasm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download WASM:', error);
    alert('Failed to download WASM file');
  }
}