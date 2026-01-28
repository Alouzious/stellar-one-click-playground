import React, { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import "./ContractEditor.css";

export default function ContractEditor({ file, onChange, status = { status: "idle", text: "" } }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // You can add language-specific diagnostics or snippets here if desired
  };

  useEffect(() => {
    // If needed, re-run validations or reconfigure editor when file changes
  }, [file]);

  if (!file) {
    return (
      <div className="editor-container">
        <div className="editor-header">
          <div style={{ flex: 1 }} />
          <div className="editor-status" />
        </div>
        <div className="no-file-message">
          <span>📄</span>
          <p>No file selected</p>
        </div>
      </div>
    );
  }

  const statusClass =
    status.status === "saving" ? "status-saving" :
    status.status === "saved" ? "status-saved" :
    status.status === "error" ? "status-error" : "";

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="file-icon">{file.language === "rust" ? "🦀" : file.language === "toml" ? "📦" : "📄"}</span>
          <div style={{ fontWeight: 600 }}>{file.name}</div>
        </div>
        <div className={`editor-status ${statusClass}`}>
          {status.status === "saving" && <span>Saving...</span>}
          {status.status === "saved" && <span>✓ {status.text}</span>}
          {status.status === "error" && <span>⚠ {status.text}</span>}
          {status.status === "idle" && <span>{status.text}</span>}
        </div>
      </div>

      <MonacoEditor
        height="100%"
        defaultLanguage={file.language}
        language={file.language}
        value={file.content}
        onChange={(value) => onChange(value)}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          tabSize: 2,
          folding: true,
          quickSuggestions: { other: true },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          snippetSuggestions: "top",
        }}
      />
    </div>
  );
}