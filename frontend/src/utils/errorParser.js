/**
 * Parse errors from build response and format for Monaco Editor
 */
export function parseErrorsForMonaco(errors, files) {
  if (!errors || errors.length === 0) return [];

  return errors.map(error => {
    // Map file path to your file structure
    const filePath = normalizeFilePath(error.file);
    const file = files.find(f => f.path === filePath || f.path.endsWith(error.file));

    return {
      severity: getSeverity(error.severity),
      startLineNumber: error.line || 1,
      startColumn: error.column || 1,
      endLineNumber: error.line || 1,
      endColumn: (error.column || 1) + 10, // Underline ~10 chars
      message: error.message,
      code: error.code,
      file: filePath,
      source: 'rust-compiler'
    };
  });
}

/**
 * Get Monaco Editor severity constant
 */
function getSeverity(severity) {
  const monaco = window.monaco;
  if (!monaco) return 8; // Default to Error

  switch (severity) {
    case 'error':
      return monaco.MarkerSeverity.Error; // 8
    case 'warning':
      return monaco.MarkerSeverity.Warning; // 4
    case 'info':
      return monaco.MarkerSeverity.Info; // 2
    default:
      return monaco.MarkerSeverity.Error;
  }
}

/**
 * Normalize file paths from compiler to match your file structure
 */
function normalizeFilePath(compilerPath) {
  // Compiler says: "contract/lib.rs"
  // Your structure: "/contract/lib.rs"
  
  if (!compilerPath || compilerPath === 'unknown') return null;
  
  // Remove /work prefix if present
  let path = compilerPath.replace(/^\/work\//, '');
  
  // Add leading slash if not present
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  return path;
}

/**
 * Count errors by severity
 */
export function getErrorCounts(errors) {
  const counts = {
    error: 0,
    warning: 0,
    info: 0
  };

  if (!errors) return counts;

  errors.forEach(err => {
    const sev = err.severity?.toLowerCase() || 'error';
    if (counts.hasOwnProperty(sev)) {
      counts[sev]++;
    }
  });

  return counts;
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error) {
  let message = error.message;
  
  if (error.code) {
    message = `[${error.code}] ${message}`;
  }
  
  return message;
}

/**
 * Group errors by file
 */
export function groupErrorsByFile(errors) {
  const grouped = {};
  
  errors.forEach(error => {
    const file = error.file || 'unknown';
    if (!grouped[file]) {
      grouped[file] = [];
    }
    grouped[file].push(error);
  });
  
  return grouped;
}