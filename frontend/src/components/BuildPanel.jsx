import React, { useState } from "react";
import { 
  Hammer, 
  FlaskConical, 
  Rocket, 
  Terminal as TerminalIcon,
  CheckCircle2,
  XCircle,
  Download,
  Loader2
} from "lucide-react";
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
          disabled={isBuilding}
          title="Build project"
        >
          {isBuilding ? (
            <>
              <Loader2 size={16} className="spinner" />
              Building...
            </>
          ) : (
            <>
              <Hammer size={16} />
              Build
            </>
          )}
        </button>

        <button
          className="build-btn test"
          onClick={onTest}
          disabled={isTesting}
          title="Run tests"
        >
          {isTesting ? (
            <>
              <Loader2 size={16} className="spinner" />
              Testing...
            </>
          ) : (
            <>
              <FlaskConical size={16} />
              Test
            </>
          )}
        </button>

        <button
          className="build-btn deploy"
          onClick={onDeploy}
          disabled={isDeploying}
          title="Deploy project"
        >
          {isDeploying ? (
            <>
              <Loader2 size={16} className="spinner" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket size={16} />
              Deploy
            </>
          )}
        </button>

        <button
          className="build-btn terminal"
          onClick={onOpenTerminal}
          title="Open terminal"
        >
          <TerminalIcon size={16} />
          Terminal
          {hasTerminalLogs && <span className="terminal-badge" />}
        </button>
      </div>

      {lastBuildStatus && (
        <div className={`build-status ${lastBuildStatus.success ? 'success' : 'error'}`}>
          <span className="status-icon">
            {lastBuildStatus.success ? (
              <CheckCircle2 size={16} />
            ) : (
              <XCircle size={16} />
            )}
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
              <Download size={14} />
              Download WASM
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