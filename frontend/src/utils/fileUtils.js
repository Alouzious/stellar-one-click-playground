/**
 * Utility functions for file operations
 */

// Maximum file size: 2MB (matching database policy of 200,000 chars ≈ 2MB)
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FILE_CHARS = 200000; // Database limit

/**
 * Calculate byte size of a string
 */
export function bytesSize(str) {
  return new Blob([str]).size;
}

/**
 * Validate file name with comprehensive rules
 */
export function validateFileName(name) {
  // Check if empty
  if (!name || name.trim().length === 0) {
    return "File name cannot be empty";
  }

  const trimmedName = name.trim();

  // Check length
  if (trimmedName.length < 1) {
    return "File name is too short";
  }
  if (trimmedName.length > 100) {
    return "File name is too long (max 100 characters)";
  }

  // Must start with letter or number
  if (!/^[a-zA-Z0-9]/.test(trimmedName)) {
    return "File name must start with a letter or number";
  }

  // Must end with letter, number, or extension
  if (!/[a-zA-Z0-9]$/.test(trimmedName.replace(/\.[^.]+$/, ""))) {
    return "Invalid file name format";
  }

  // Valid characters only (alphanumeric, dash, underscore, dot)
  if (!/^[a-zA-Z0-9\-_\.]+$/.test(trimmedName)) {
    return "Only letters, numbers, hyphens, underscores, and dots allowed";
  }

  // No consecutive dots
  if (/\.\./.test(trimmedName)) {
    return "Consecutive dots are not allowed";
  }

  // No leading/trailing dots or dashes
  if (/^[.\-]|[.\-]$/.test(trimmedName)) {
    return "File name cannot start or end with dot or dash";
  }

  // Reserved names (Windows)
  const reserved = [
    "con", "prn", "aux", "nul",
    "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
    "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
  ];
  const baseName = trimmedName.toLowerCase().split(".")[0];
  if (reserved.includes(baseName)) {
    return `"${baseName}" is a reserved file name`;
  }

  return null; // Valid
}

/**
 * Normalize file name (add extension if missing)
 */
export function normalizeFileName(name) {
  const trimmed = name.trim();
  
  // If no extension and not a special file, add .rs
  if (!trimmed.includes(".") && !trimmed.startsWith(".")) {
    return `${trimmed}.rs`;
  }
  
  return trimmed;
}

/**
 * Determine default folder based on file name/extension
 */
export function defaultFolderForName(name) {
  const lowerName = name.toLowerCase();
  
  // Rust files
  if (lowerName.endsWith(".rs")) {
    if (lowerName.includes("test") || lowerName.includes("integration")) {
      return "/tests";
    }
    return "/contract";
  }
  
  // Config files
  if (lowerName.endsWith(".toml") || lowerName === "cargo.toml") {
    return "/";
  }
  
  // Documentation
  if (lowerName.endsWith(".md")) {
    return "/";
  }
  
  // Scripts
  if (lowerName.endsWith(".sh") || lowerName.endsWith(".bash")) {
    return "/scripts";
  }
  
  // JSON files
  if (lowerName.endsWith(".json")) {
    return "/";
  }
  
  // Default to root
  return "/";
}

/**
 * Determine language/syntax highlighting based on file extension
 */
export function getLanguageFromFileName(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  
  const languageMap = {
    rs: "rust",
    toml: "toml",
    md: "markdown",
    json: "json",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    sh: "bash",
    bash: "bash",
    yml: "yaml",
    yaml: "yaml",
    txt: "plaintext",
    gitignore: "plaintext",
  };
  
  return languageMap[ext] || "plaintext";
}

/**
 * Get file icon emoji based on name/extension
 */
export function getFileIcon(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.endsWith(".rs")) return "🦀";
  if (lowerName.endsWith(".toml")) return "📦";
  if (lowerName.endsWith(".md")) return "📝";
  if (lowerName.endsWith(".sh") || lowerName.endsWith(".bash")) return "⚡";
  if (lowerName.endsWith(".json")) return "🔧";
  if (lowerName.endsWith(".yml") || lowerName.endsWith(".yaml")) return "📋";
  if (lowerName === ".gitignore") return "🚫";
  if (lowerName.endsWith(".txt")) return "📄";
  
  return "📄";
}

/**
 * Download a file to user's computer
 */
export function downloadFile(file) {
  try {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    return false;
  }
}

/**
 * Download all files as individual files (browser limitation - one at a time)
 */
export function downloadAllFiles(files) {
  if (!files || files.length === 0) {
    alert("No files to download");
    return;
  }
  
  files.forEach((file, index) => {
    setTimeout(() => {
      downloadFile(file);
    }, index * 500); // Stagger downloads
  });
}

/**
 * Format file path for display
 */
export function formatPath(path) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Get user initials from name or email
 */
export function getInitials(nameOrEmail = "") {
  const name = (nameOrEmail || "").trim();
  if (!name) return "ME";
  
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  return name.slice(0, 2).toUpperCase();
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(content) {
  const size = bytesSize(content);
  const charLength = content.length;
  
  return size <= MAX_FILE_BYTES && charLength <= MAX_FILE_CHARS;
}

/**
 * Get readable file size
 */
export function getReadableFileSize(content) {
  const bytes = bytesSize(content);
  
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  // Less than 1 minute
  if (diffMins < 1) return "Just now";
  
  // Less than 1 hour
  if (diffMins < 60) return `${diffMins}m ago`;
  
  // Less than 24 hours
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  // Less than 7 days
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Format as date
  return date.toLocaleDateString();
}