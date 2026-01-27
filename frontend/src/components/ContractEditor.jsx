import { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import "./ContractEditor.css";

export default function ContractEditor({ file, onChange }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Handle editor mounting
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure Rust language features
    if (file?.language === "rust") {
      setupRustDiagnostics(monaco, editor);
    }

    // Configure TOML language features
    if (file?.language === "toml") {
      setupTomlDiagnostics(monaco, editor);
    }
  };

  // Setup Rust diagnostics and error checking
  const setupRustDiagnostics = (monaco, editor) => {
    // Add custom Rust keywords and snippets
    monaco.languages.registerCompletionItemProvider('rust', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'contracttype',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: '#[contracttype]\npub struct ${1:MyStruct};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Soroban contract type attribute'
          },
          {
            label: 'contractimpl',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: '#[contractimpl]\nimpl ${1:MyContract} {\n    ${2}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Soroban contract implementation'
          },
          {
            label: 'contract',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: '#[contract]\npub struct ${1:MyContract};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Soroban contract attribute'
          },
          {
            label: 'pub fn',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'pub fn ${1:function_name}(${2}) -> ${3:ReturnType} {\n    ${4}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Public function'
          },
        ];
        return { suggestions };
      }
    });

    // Basic syntax validation for Rust
    const validateRustCode = () => {
      const model = editor.getModel();
      const code = model.getValue();
      const markers = [];

      // Check for common Rust errors
      const lines = code.split('\n');
      lines.forEach((line, index) => {
        // Check for missing semicolons (simple check)
        if (line.trim().match(/^\s*(let|return|[a-zA-Z_][a-zA-Z0-9_]*\s*=).*[^;{}\s]$/)) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: index + 1,
            startColumn: 1,
            endLineNumber: index + 1,
            endColumn: line.length + 1,
            message: 'Consider adding a semicolon at the end of this statement'
          });
        }

        // Check for missing use statements for common Soroban items
        if (line.includes('contracttype') && !code.includes('use soroban_sdk::')) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: index + 1,
            startColumn: 1,
            endLineNumber: index + 1,
            endColumn: line.length + 1,
            message: 'Missing "use soroban_sdk::*;" at the top of the file',
            tags: [monaco.MarkerTag.Unnecessary]
          });
        }

        // Check for #![no_std]
        if (index === 0 && !line.includes('#![no_std]') && code.includes('soroban_sdk')) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: 'Soroban contracts should start with #![no_std]'
          });
        }

        // Check for common typos in attributes
        if (line.match(/#\[contract\s*type\]/)) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: index + 1,
            startColumn: line.indexOf('contract') + 1,
            endLineNumber: index + 1,
            endColumn: line.indexOf('type') + 5,
            message: 'Did you mean #[contracttype]? (no space)'
          });
        }

        if (line.match(/#\[contract\s*impl\]/)) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: index + 1,
            startColumn: line.indexOf('contract') + 1,
            endLineNumber: index + 1,
            endColumn: line.indexOf('impl') + 5,
            message: 'Did you mean #[contractimpl]? (no space)'
          });
        }
      });

      monaco.editor.setModelMarkers(model, 'rust', markers);
    };

    // Validate on content change
    editor.onDidChangeModelContent(() => {
      validateRustCode();
    });

    // Initial validation
    validateRustCode();
  };

  // Setup TOML diagnostics
  const setupTomlDiagnostics = (monaco, editor) => {
    monaco.languages.registerCompletionItemProvider('toml', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: '[package]',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: '[package]\nname = "${1:package-name}"\nversion = "${2:0.1.0}"\nedition = "${3:2021}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Package definition section'
          },
          {
            label: '[dependencies]',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: '[dependencies]\n${1}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Dependencies section'
          },
          {
            label: 'soroban-sdk',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'soroban-sdk = "${1:21.7.7}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Soroban SDK dependency'
          },
        ];
        return { suggestions };
      }
    });

    const validateTomlCode = () => {
      const model = editor.getModel();
      const code = model.getValue();
      const markers = [];
      const lines = code.split('\n');

      lines.forEach((line, index) => {
        // Check for unclosed quotes
        const quotes = (line.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: index + 1,
            startColumn: 1,
            endLineNumber: index + 1,
            endColumn: line.length + 1,
            message: 'Unclosed quote in this line'
          });
        }

        // Check for missing = in key-value pairs
        if (line.trim() && !line.trim().startsWith('[') && !line.trim().startsWith('#') && !line.includes('=')) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: index + 1,
            startColumn: 1,
            endLineNumber: index + 1,
            endColumn: line.length + 1,
            message: 'Missing "=" in key-value pair'
          });
        }
      });

      // Check for required sections
      if (!code.includes('[package]')) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: 'Missing [package] section in Cargo.toml'
        });
      }

      if (!code.includes('[dependencies]')) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: 'Missing [dependencies] section'
        });
      }

      monaco.editor.setModelMarkers(model, 'toml', markers);
    };

    editor.onDidChangeModelContent(() => {
      validateTomlCode();
    });

    validateTomlCode();
  };

  // Re-setup diagnostics when file changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current && file) {
      if (file.language === "rust") {
        setupRustDiagnostics(monacoRef.current, editorRef.current);
      } else if (file.language === "toml") {
        setupTomlDiagnostics(monacoRef.current, editorRef.current);
      }
    }
  }, [file]);

  if (!file) {
    return (
      <div className="editor-container">
        <div className="no-file-message">
          <span>📄</span>
          <p>No file selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <span className="file-icon">
          {file.language === 'rust' ? '🦀' : '📦'}
        </span>
        {file.name}
      </div>
      <MonacoEditor
        height="100%"
        defaultLanguage={file.language}
        language={file.language}
        value={file.content}
        onChange={onChange}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          tabSize: 2,
          // Enable error highlighting
          glyphMargin: true,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          // Quick suggestions
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: "on",
          snippetSuggestions: "top",
          // Validation
          'semanticHighlighting.enabled': true,
        }}
      />
    </div>
  );
}