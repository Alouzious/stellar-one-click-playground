import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ErrorBoundary from "./components/ErrorBoundary";
import FileSidebar from "./components/FileSidebar";
import ContractEditor from "./components/ContractEditor";
import { defaultTemplates } from "./defaultTemplates";
import {
  validateFileName,
  normalizeFileName,
  defaultFolderForName,
  getLanguageFromFileName,
  downloadFile,
  downloadAllFiles,
  isFileSizeValid,
  getReadableFileSize,
  getInitials,
} from "./utils/fileUtils";
import { useKeyboardShortcuts, useBeforeUnload } from "./hooks/useCustomHooks";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loggingIn, setLoggingIn] = useState(true);
  const [files, setFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);

  const [savingMap, setSavingMap] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const [lastSavedMap, setLastSavedMap] = useState({});
  const [errorMap, setErrorMap] = useState({});

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(null);
  const [isRenamingFile, setIsRenamingFile] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const avatarRef = useRef(null);
  const saveTimeoutRef = useRef({});
  const fileInputRef = useRef(null);

  const activeFile = files.find((f) => f.path === activePath);

  // Protected core files
  const protectedPaths = new Set([
    "/Cargo.toml",
    "/contract/lib.rs",
    "/README.md"
  ]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = Object.values(savingMap).some(v => v);

  // Warn before leaving with unsaved changes
  useBeforeUnload(hasUnsavedChanges);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "n",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        handleNewFile();
      },
    },
    {
      key: "s",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        // File is auto-saved, just show notification
        if (activeFile) {
          const key = fileKey(activeFile);
          if (!savingMap[key]) {
            alert("✓ File already saved");
          }
        }
      },
    },
    {
      key: "d",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        if (activeFile) {
          downloadFile(activeFile);
        }
      },
    },
    {
      key: "o",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        setShowUploadDialog(true);
      },
    },
  ]);

  // Auth logic
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoggingIn(false);
    });

    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    }) || {};

    return () => subscription?.unsubscribe?.();
  }, []);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach((t) => clearTimeout(t));
      saveTimeoutRef.current = {};
    };
  }, []);

  // When user changes
  useEffect(() => {
    if (user) ensureProjectStructureForUser();
    else {
      setFiles([]);
      setActivePath(null);
      setSavingMap({});
      setSavedMap({});
      setLastSavedMap({});
      setErrorMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load files for user
  async function loadFiles() {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .order("path");
        
      if (error) throw error;
      
      setFiles(data || []);
      
      const lastSaved = {};
      (data || []).forEach((f) => {
        const key = f.id || f.path;
        if (f.updated_at) lastSaved[key] = f.updated_at;
      });
      
      setLastSavedMap(lastSaved);
      setSavedMap({});
      setSavingMap({});
      setErrorMap({});
      
      if (data && data.length) {
        setActivePath((prev) => prev || data[0].path);
      }
    } catch (error) {
      console.error("Error loading files:", error);
      alert("Failed to load files. Please refresh the page.");
    }
  }

  // Ensure project skeleton
  async function ensureProjectStructureForUser() {
    if (!user) return;
    
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from("files")
        .select("path")
        .eq("user_id", user.id);
        
      if (fetchErr) throw fetchErr;
      
      const existingPaths = new Set((existing || []).map((r) => r.path));

      const toInsert = defaultTemplates
        .filter((t) => !existingPaths.has(t.path))
        .map((t) => ({
          user_id: user.id,
          name: t.name,
          path: t.path,
          language: t.language,
          content: t.content,
        }));

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from("files")
          .insert(toInsert);
          
        if (insertErr) throw insertErr;
      }

      await loadFiles();
    } catch (error) {
      console.error("Error setting up project:", error);
      alert("Failed to set up project structure. Please try again.");
    }
  }

  // Auth actions
  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google" });
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Failed to sign in. Please try again.");
    }
  };

  const signOut = async () => {
    try {
      if (hasUnsavedChanges) {
        if (!window.confirm("You have unsaved changes. Are you sure you want to sign out?")) {
          return;
        }
      }
      
      await supabase.auth.signOut();
      setFiles([]);
      setActivePath(null);
      setSavingMap({});
      setSavedMap({});
      setLastSavedMap({});
      setErrorMap({});
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  // Helpers
  const fileKey = (f) => f?.id || f?.path;

  // Create new file with improved validation
  const handleNewFile = async () => {
    if (!user) {
      alert("Please sign in first.");
      return;
    }
    
    if (isCreatingFile) return;

    let name = prompt("Enter file name (e.g., contract.rs, test.rs, deploy.sh):");
    if (!name) return;

    name = name.trim();

    // Validate file name
    const validationError = validateFileName(name);
    if (validationError) {
      alert(validationError);
      return;
    }

    name = normalizeFileName(name);

    // Check if file already exists
    if (files.find((f) => f.name === name)) {
      alert("A file with this name already exists!");
      return;
    }

    const folder = defaultFolderForName(name);
    const path = (folder === "/" ? "" : folder) + "/" + name;
    const lang = getLanguageFromFileName(name);

    setIsCreatingFile(true);

    try {
      const { data, error } = await supabase
        .from("files")
        .insert([{ 
          user_id: user.id, 
          name, 
          path, 
          language: lang, 
          content: "" 
        }])
        .select();

      if (error) throw error;

      if (data?.[0]) {
        setFiles((prev) => [...prev, data[0]]);
        setActivePath(path);
        
        const key = data[0].id || data[0].path;
        setSavedMap((s) => ({ ...s, [key]: true }));
        
        if (data[0].updated_at) {
          setLastSavedMap((m) => ({ ...m, [key]: data[0].updated_at }));
        }
      }
    } catch (error) {
      console.error("Error creating file:", error);
      alert("Failed to create file. Please try again.");
    } finally {
      setIsCreatingFile(false);
    }
  };

  // Delete file with loading state
  const handleDeleteFile = async (path) => {
    if (!user) return;
    
    if (protectedPaths.has(path)) {
      alert("This file is protected and cannot be deleted.");
      return;
    }

    const file = files.find((f) => f.path === path);
    if (!file) return;

    if (!window.confirm(`Delete "${file.name}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeletingFile(path);

    try {
      const { error } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (error) throw error;

      // Clean up
      const key = fileKey(file);
      if (saveTimeoutRef.current[key]) {
        clearTimeout(saveTimeoutRef.current[key]);
        delete saveTimeoutRef.current[key];
      }

      setSavingMap((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      setSavedMap((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      setLastSavedMap((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });
      setErrorMap((s) => {
        const n = { ...s };
        delete n[key];
        return n;
      });

      const newFiles = files.filter((f) => f.path !== path);
      setFiles(newFiles);

      if (activePath === path && newFiles.length) {
        setActivePath(newFiles[0].path);
      }
      if (newFiles.length === 0) {
        setActivePath(null);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete file. Please try again.");
    } finally {
      setIsDeletingFile(null);
    }
  };

  // Rename file with loading state
  const handleRenameFile = async (oldPath) => {
    if (!user) return;
    
    if (protectedPaths.has(oldPath)) {
      alert("This file is protected and cannot be renamed.");
      return;
    }

    const file = files.find((f) => f.path === oldPath);
    if (!file) return;

    let newName = prompt("Rename file to:", file.name);
    if (!newName || newName === file.name) return;

    // Validate new name
    const validationError = validateFileName(newName);
    if (validationError) {
      alert(validationError);
      return;
    }

    newName = normalizeFileName(newName);

    // Check if new name already exists
    if (files.find((f) => f.name === newName && f.path !== oldPath)) {
      alert("A file with this name already exists!");
      return;
    }

    setIsRenamingFile(oldPath);

    try {
      // Keep same parent folder
      const parent = oldPath.lastIndexOf("/") >= 0 
        ? oldPath.slice(0, oldPath.lastIndexOf("/")) 
        : "";
      const newPath = (parent === "" ? "" : parent) + "/" + newName;
      const lang = getLanguageFromFileName(newName);

      const { data, error } = await supabase
        .from("files")
        .update({ name: newName, path: newPath, language: lang })
        .eq("id", file.id)
        .select();

      if (error) throw error;

      if (data?.[0]) {
        setFiles((prev) =>
          prev.map((f) => (f.path === oldPath ? data[0] : f))
        );

        if (activePath === oldPath) {
          setActivePath(newPath);
        }

        const key = fileKey(data[0]);
        if (data[0].updated_at) {
          setLastSavedMap((m) => ({ ...m, [key]: data[0].updated_at }));
        }
      }
    } catch (error) {
      console.error("Rename error:", error);
      alert("Failed to rename file. Please try again.");
    } finally {
      setIsRenamingFile(null);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    if (!user) return;

    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    // Validate file name
    const validationError = validateFileName(uploadedFile.name);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Check if file already exists
    if (files.find((f) => f.name === uploadedFile.name)) {
      if (!window.confirm(`File "${uploadedFile.name}" already exists. Replace it?`)) {
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;

      // Validate file size
      if (!isFileSizeValid(content)) {
        alert(
          `File is too large (${getReadableFileSize(content)}). Maximum size is 2MB.`
        );
        return;
      }

      try {
        const folder = defaultFolderForName(uploadedFile.name);
        const path = (folder === "/" ? "" : folder) + "/" + uploadedFile.name;
        const lang = getLanguageFromFileName(uploadedFile.name);

        // Check if replacing existing file
        const existingFile = files.find((f) => f.name === uploadedFile.name);

        if (existingFile) {
          // Update existing file
          const { error } = await supabase
            .from("files")
            .update({ content, language: lang })
            .eq("id", existingFile.id);

          if (error) throw error;

          setFiles((prev) =>
            prev.map((f) =>
              f.id === existingFile.id ? { ...f, content, language: lang } : f
            )
          );
          setActivePath(existingFile.path);
        } else {
          // Create new file
          const { data, error } = await supabase
            .from("files")
            .insert([{
              user_id: user.id,
              name: uploadedFile.name,
              path,
              language: lang,
              content,
            }])
            .select();

          if (error) throw error;

          if (data?.[0]) {
            setFiles((prev) => [...prev, data[0]]);
            setActivePath(path);
          }
        }

        alert(`✓ File "${uploadedFile.name}" uploaded successfully!`);
      } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to upload file. Please try again.");
      }
    };

    reader.onerror = () => {
      alert("Failed to read file. Please try again.");
    };

    reader.readAsText(uploadedFile);
    
    // Reset input
    event.target.value = "";
    setShowUploadDialog(false);
  };

  // Download current file
  const handleDownloadFile = useCallback(() => {
    if (activeFile) {
      const success = downloadFile(activeFile);
      if (success) {
        alert(`✓ "${activeFile.name}" downloaded successfully!`);
      } else {
        alert("Failed to download file. Please try again.");
      }
    }
  }, [activeFile]);

  // Download all files
  const handleDownloadAll = useCallback(() => {
    if (files.length === 0) {
      alert("No files to download.");
      return;
    }

    if (window.confirm(`Download all ${files.length} files? They will be downloaded one by one.`)) {
      downloadAllFiles(files);
    }
  }, [files]);

  // Debounced save logic
  const onChange = (val) => {
    if (!user || !activePath) return;

    const idx = files.findIndex((f) => f.path === activePath);
    if (idx === -1) return;

    const file = files[idx];
    const key = fileKey(file);

    setFiles((prev) =>
      prev.map((f) => (f.path === activePath ? { ...f, content: val } : f))
    );

    // Check file size
    if (!isFileSizeValid(val)) {
      if (!file._sizeWarnShown) {
        alert(
          `File exceeds 2MB limit. Current size: ${getReadableFileSize(val)}. Please reduce content to save.`
        );
        setFiles((prev) =>
          prev.map((f) =>
            f.path === activePath ? { ...f, _sizeWarnShown: true } : f
          )
        );
      }
      return;
    }

    if (file._sizeWarnShown) {
      setFiles((prev) =>
        prev.map((f) =>
          f.path === activePath ? { ...f, _sizeWarnShown: false } : f
        )
      );
    }

    setSavingMap((s) => ({ ...s, [key]: true }));
    setErrorMap((s) => ({ ...s, [key]: false }));

    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    saveTimeoutRef.current[key] = setTimeout(async () => {
      try {
        const latest = files.find((x) => (x.id || x.path) === key) || file;
        const contentToSave = latest?.content ?? val;

        if (!file.id) {
          console.warn("Skipping save: file has no id.");
          setSavingMap((s) => ({ ...s, [key]: false }));
          return;
        }

        const { error } = await supabase
          .from("files")
          .update({ content: contentToSave })
          .eq("id", file.id)
          .select();

        if (error) throw error;

        const now = new Date().toISOString();
        setSavedMap((s) => ({ ...s, [key]: true }));
        setLastSavedMap((m) => ({ ...m, [key]: now }));
        setErrorMap((s) => ({ ...s, [key]: false }));
      } catch (error) {
        console.error("Save error:", error);
        setErrorMap((s) => ({ ...s, [key]: true }));
        setSavedMap((s) => ({ ...s, [key]: false }));
      } finally {
        setSavingMap((s) => ({ ...s, [key]: false }));
        delete saveTimeoutRef.current[key];
      }
    }, 700);
  };

  // Get status for file
  function getStatusForFile(f) {
    const key = fileKey(f);
    if (savingMap[key]) return { status: "saving", text: "Saving..." };
    if (errorMap[key]) return { status: "error", text: "Save error" };
    if (savedMap[key] || lastSavedMap[key]) {
      const last = lastSavedMap[key];
      const text = last
        ? `Saved • ${new Date(last).toLocaleString()}`
        : "Saved";
      return { status: "saved", text };
    }
    return { status: "idle", text: "" };
  }

  // Loading state
  if (loggingIn) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-icon">🦀</div>
          <h1 className="login-title">Soroban IDE</h1>
          <p className="login-subtitle">Build smart contracts for Stellar</p>
          <button onClick={signInWithGoogle} className="google-signin-btn">
            <span>🔐</span>
            <span>Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    user.id
  );

  return (
    <ErrorBoundary>
      <div className="app-container">
        <div className="topbar">
          <div className="topbar-left">
            <div className="app-logo">
              <span className="app-logo-icon">🦀</span>
              <span>Soroban IDE</span>
            </div>
            
            <div className="topbar-actions">
              <button
                className="topbar-btn"
                onClick={handleDownloadFile}
                disabled={!activeFile}
                title="Download current file (Ctrl+D)"
              >
                ⬇️ Download
              </button>
              
              <button
                className="topbar-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file (Ctrl+O)"
              >
                ⬆️ Upload
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileUpload}
                accept=".rs,.toml,.md,.sh,.json,.txt"
              />
            </div>
          </div>
          
          <div className="topbar-right">
            <div className="keyboard-hint">
              💡 Ctrl+N: New | Ctrl+S: Save | Ctrl+D: Download
            </div>
            
            <div className="avatar-area" ref={avatarRef}>
              <button
                className="avatar-btn"
                onClick={() => setAvatarOpen((s) => !s)}
                title="Account"
              >
                {initials}
              </button>
              {avatarOpen && (
                <div className="avatar-dropdown">
                  <div className="avatar-name">
                    {user.user_metadata?.name || user.email}
                  </div>
                  <button className="dropdown-btn" onClick={handleDownloadAll}>
                    📦 Download All Files
                  </button>
                  <button className="dropdown-btn" onClick={signOut}>
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="main-content">
          <FileSidebar
            files={files}
            activePath={activePath}
            setActivePath={setActivePath}
            onNewFile={handleNewFile}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            savingMap={savingMap}
            savedMap={savedMap}
            lastSavedMap={lastSavedMap}
            errorMap={errorMap}
            protectedPaths={protectedPaths}
            isCreatingFile={isCreatingFile}
            isDeletingFile={isDeletingFile}
            isRenamingFile={isRenamingFile}
          />
          
          <ContractEditor
            file={activeFile}
            onChange={onChange}
            status={
              activeFile
                ? getStatusForFile(activeFile)
                : { status: "idle", text: "" }
            }
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}