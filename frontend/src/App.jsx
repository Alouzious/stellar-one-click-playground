import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Components
import ErrorBoundary from "./components/ErrorBoundary";
import FileSidebar from "./components/FileSidebar";
import ContractEditor from "./components/ContractEditor";
import BuildPanel from "./components/BuildPanel";
import Terminal from "./components/Terminal";
import WelcomeScreen from "./components/WelcomeScreen";

// Data & Utils
import { defaultTemplates } from "./defaultTemplates";
import {
  buildContract,
  testContract,
  deployContract,
  parseBuildLogs,
  getWasmSize,
} from "./utils/buildApi";
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

// Hooks
import { useKeyboardShortcuts, useBeforeUnload } from "./hooks/useCustomHooks";

// Styles
import "./App.css";

// Constants
const PROTECTED_PATHS = new Set([
  "/Cargo.toml",
  "/contract/lib.rs",
]);

export default function App() {
  // State
  const [user, setUser] = useState(null);
  const [loggingIn, setLoggingIn] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [files, setFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  
  const [savingMap, setSavingMap] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const [lastSavedMap, setLastSavedMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(null);
  const [isRenamingFile, setIsRenamingFile] = useState(null);
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [lastBuildStatus, setLastBuildStatus] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([]);
  
  const avatarRef = useRef(null);
  const saveTimeoutRef = useRef({});
  const fileInputRef = useRef(null);
  
  const activeFile = files.find((f) => f.path === activePath);
  const hasUnsavedChanges = Object.values(savingMap).some(v => v);

  // Hooks
  useBeforeUnload(hasUnsavedChanges);
  
  // Check if user has visited before
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedIDE');
    if (hasVisited) {
      setShowWelcome(false);
    }
  }, []);
  
  // Authentication
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
  
  // Close avatar dropdown
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
    if (user) {
      ensureProjectStructureForUser();
    } else {
      resetAppState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Terminal logging
  const addLog = useCallback((text, type = 'default', prefix = '>') => {
    setTerminalLogs(prev => [
      ...prev,
      {
        text,
        type,
        prefix,
        timestamp: new Date().toISOString(),
      }
    ]);
  }, []);

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
        if (activeFile) {
          const key = fileKey(activeFile);
          if (!savingMap[key]) {
            alert("✓ File already saved");
          }
        }
      },
    },
    {
      key: "b",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        handleBuild();
      },
    },
    {
      key: "t",
      ctrlKey: true,
      callback: (e) => {
        e.preventDefault();
        handleTest();
      },
    },
  ]);

  // Project setup - FIXED VERSION
  async function ensureProjectStructureForUser() {
    if (!user) return;
    
    try {
      addLog("Initializing project...", "info", "ℹ");

      // Get or create project
      const { data: existingProjects, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .limit(1);

      if (fetchError) throw fetchError;

      let project;
      
      if (existingProjects && existingProjects.length > 0) {
        project = existingProjects[0];
        addLog(`Loaded project: ${project.name}`, "success", "✓");
      } else {
        const { data: newProject, error: createError } = await supabase
          .from("projects")
          .insert([{
            user_id: user.id,
            name: `${user.email?.split('@')[0] || 'user'}-soroban-project`,
          }])
          .select()
          .single();

        if (createError) throw createError;
        
        project = newProject;
        addLog(`Created new project: ${project.name}`, "success", "✓");
      }

      setProjectId(project.id);

      // Load existing files
      const { data: existingFiles, error: filesError } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", project.id);

      if (filesError) throw filesError;

      // If files exist, just load them and exit
      if (existingFiles && existingFiles.length > 0) {
        setFiles(existingFiles);
        
        const lastSaved = {};
        existingFiles.forEach((f) => {
          const key = f.id || f.path;
          if (f.updated_at) lastSaved[key] = f.updated_at;
        });
        
        setLastSavedMap(lastSaved);
        setSavedMap({});
        setSavingMap({});
        setErrorMap({});
        
        setActivePath((prev) => prev || existingFiles[0].path);
        addLog("Project ready!", "success", "✓");
        return; // EXIT HERE - Don't create template files!
      }

      // Only create template files if NO files exist
      const toInsert = defaultTemplates.map((t) => ({
        user_id: user.id,
        project_id: project.id,
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
        addLog(`Created ${toInsert.length} template files`, "success", "✓");
      }

      // Load files
      const { data: newFiles } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", project.id)
        .order("path");

      setFiles(newFiles || []);
      if (newFiles && newFiles.length) {
        setActivePath(newFiles[0].path);
      }
      
      addLog("Project ready!", "success", "✓");
    } catch (error) {
      console.error("Error setting up project:", error);
      addLog(`Error: ${error.message}`, "error", "✗");
    }
  }
  
  function resetAppState() {
    setFiles([]);
    setActivePath(null);
    setProjectId(null);
    setSavingMap({});
    setSavedMap({});
    setLastSavedMap({});
    setErrorMap({});
    setTerminalLogs([]);
    setLastBuildStatus(null);
  }

  // Build/Test/Deploy handlers
  const handleBuild = async () => {
    if (!projectId) {
      alert("No project selected");
      return;
    }

    setIsBuilding(true);
    setTerminalOpen(true);
    addLog("Starting build...", "info", "🔨");

    try {
      const result = await buildContract(projectId);
      
      const parsedLogs = parseBuildLogs(result.logs);
      parsedLogs.forEach(log => {
        addLog(log.text, log.type, log.type === 'error' ? '✗' : log.type === 'success' ? '✓' : '>');
      });

      if (result.success) {
        const size = getWasmSize(result.wasm_base64);
        addLog(`Build successful! WASM size: ${size}`, "success", "✓");
        setLastBuildStatus({
          success: true,
          size,
          wasmBase64: result.wasm_base64,
        });
      } else {
        addLog("Build failed. Check logs above for details.", "error", "✗");
        setLastBuildStatus({ success: false });
      }
    } catch (error) {
      console.error("Build error:", error);
      addLog(`Build error: ${error.message}`, "error", "✗");
      setLastBuildStatus({ success: false });
    } finally {
      setIsBuilding(false);
    }
  };
  
  const handleTest = async () => {
    if (!projectId) {
      alert("No project selected");
      return;
    }

    setIsTesting(true);
    setTerminalOpen(true);
    addLog("Running tests...", "info", "🧪");

    try {
      const result = await testContract(projectId);
      
      const parsedLogs = parseBuildLogs(result.logs);
      parsedLogs.forEach(log => {
        addLog(log.text, log.type, log.type === 'error' ? '✗' : log.type === 'success' ? '✓' : '>');
      });

      if (result.success) {
        addLog("All tests passed!", "success", "✓");
      } else {
        addLog("Tests failed. Check logs above for details.", "error", "✗");
      }
    } catch (error) {
      console.error("Test error:", error);
      addLog(`Test error: ${error.message}`, "error", "✗");
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleDeploy = async () => {
    if (!projectId) {
      alert("No project selected");
      return;
    }

    if (!lastBuildStatus?.success || !lastBuildStatus?.wasmBase64) {
      alert("Please build successfully first");
      return;
    }

    setIsDeploying(true);
    setTerminalOpen(true);
    addLog("Deploying to Stellar testnet...", "info", "🚀");

    try {
      const result = await deployContract(projectId, lastBuildStatus.wasmBase64);
      
      if (result.success) {
        addLog(`Contract deployed successfully!`, "success", "✓");
        addLog(`Contract ID: ${result.contract_id}`, "info", "ℹ");
      } else {
        addLog("Deploy failed. Check logs above for details.", "error", "✗");
      }
    } catch (error) {
      console.error("Deploy error:", error);
      addLog(`Deploy error: ${error.message}`, "error", "✗");
    } finally {
      setIsDeploying(false);
    }
  };

  // File operations (keeping your original code)
  const handleNewFile = async () => {
    if (!user || !projectId) {
      alert("Please sign in first.");
      return;
    }
    
    if (isCreatingFile) return;

    let name = prompt("Enter file name (e.g., contract.rs, test.rs, deploy.sh):");
    if (!name) return;

    name = name.trim();
    const validationError = validateFileName(name);
    if (validationError) {
      alert(validationError);
      return;
    }

    name = normalizeFileName(name);

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
          project_id: projectId,
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

        addLog(`Created file: ${name}`, "success", "✓");
      }
    } catch (error) {
      console.error("Error creating file:", error);
      addLog(`Error creating file: ${error.message}`, "error", "✗");
      alert("Failed to create file. Please try again.");
    } finally {
      setIsCreatingFile(false);
    }
  };
  
  const handleDeleteFile = async (path) => {
    if (!user || !projectId) return;
    
    if (PROTECTED_PATHS.has(path)) {
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

      const key = fileKey(file);
      if (saveTimeoutRef.current[key]) {
        clearTimeout(saveTimeoutRef.current[key]);
        delete saveTimeoutRef.current[key];
      }

      setSavingMap((s) => { const n = { ...s }; delete n[key]; return n; });
      setSavedMap((s) => { const n = { ...s }; delete n[key]; return n; });
      setLastSavedMap((s) => { const n = { ...s }; delete n[key]; return n; });
      setErrorMap((s) => { const n = { ...s }; delete n[key]; return n; });

      const newFiles = files.filter((f) => f.path !== path);
      setFiles(newFiles);

      if (activePath === path && newFiles.length) {
        setActivePath(newFiles[0].path);
      }
      if (newFiles.length === 0) {
        setActivePath(null);
      }

      addLog(`Deleted file: ${file.name}`, "info", "ℹ");
    } catch (error) {
      console.error("Delete error:", error);
      addLog(`Error deleting file: ${error.message}`, "error", "✗");
      alert("Failed to delete file. Please try again.");
    } finally {
      setIsDeletingFile(null);
    }
  };
  
  const handleRenameFile = async (oldPath) => {
    if (!user || !projectId) return;
    
    if (PROTECTED_PATHS.has(oldPath)) {
      alert("This file is protected and cannot be renamed.");
      return;
    }

    const file = files.find((f) => f.path === oldPath);
    if (!file) return;

    let newName = prompt("Rename file to:", file.name);
    if (!newName || newName === file.name) return;

    const validationError = validateFileName(newName);
    if (validationError) {
      alert(validationError);
      return;
    }

    newName = normalizeFileName(newName);

    if (files.find((f) => f.name === newName && f.path !== oldPath)) {
      alert("A file with this name already exists!");
      return;
    }

    setIsRenamingFile(oldPath);

    try {
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

        addLog(`Renamed file: ${file.name} → ${newName}`, "info", "ℹ");
      }
    } catch (error) {
      console.error("Rename error:", error);
      addLog(`Error renaming file: ${error.message}`, "error", "✗");
      alert("Failed to rename file. Please try again.");
    } finally {
      setIsRenamingFile(null);
    }
  };
  
  const handleFileUpload = async (event) => {
    if (!user || !projectId) return;

    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    const validationError = validateFileName(uploadedFile.name);
    if (validationError) {
      alert(validationError);
      return;
    }

    if (files.find((f) => f.name === uploadedFile.name)) {
      if (!window.confirm(`File "${uploadedFile.name}" already exists. Replace it?`)) {
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;

      if (!isFileSizeValid(content)) {
        alert(`File is too large (${getReadableFileSize(content)}). Maximum size is 2MB.`);
        return;
      }

      try {
        const folder = defaultFolderForName(uploadedFile.name);
        const path = (folder === "/" ? "" : folder) + "/" + uploadedFile.name;
        const lang = getLanguageFromFileName(uploadedFile.name);

        const existingFile = files.find((f) => f.name === uploadedFile.name);

        if (existingFile) {
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
          const { data, error } = await supabase
            .from("files")
            .insert([{
              user_id: user.id,
              project_id: projectId,
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

        addLog(`Uploaded file: ${uploadedFile.name}`, "success", "✓");
      } catch (error) {
        console.error("Upload error:", error);
        addLog(`Error uploading file: ${error.message}`, "error", "✗");
        alert("Failed to upload file. Please try again.");
      }
    };

    reader.onerror = () => {
      alert("Failed to read file. Please try again.");
    };

    reader.readAsText(uploadedFile);
    event.target.value = "";
  };
  
  const handleDownloadFile = useCallback(() => {
    if (activeFile) {
      const success = downloadFile(activeFile);
      if (success) {
        addLog(`Downloaded file: ${activeFile.name}`, "info", "ℹ");
      } else {
        addLog(`Failed to download file: ${activeFile.name}`, "error", "✗");
      }
    }
  }, [activeFile, addLog]);
  
  const handleDownloadAll = useCallback(() => {
    if (files.length === 0) {
      alert("No files to download.");
      return;
    }

    if (window.confirm(`Download all ${files.length} files? They will be downloaded one by one.`)) {
      downloadAllFiles(files);
      addLog(`Downloaded ${files.length} files`, "info", "ℹ");
    }
  }, [files, addLog]);

  // File content management
  const onChange = (val) => {
    if (!user || !activePath || !projectId) return;

    const idx = files.findIndex((f) => f.path === activePath);
    if (idx === -1) return;

    const file = files[idx];
    const key = fileKey(file);

    setFiles((prev) =>
      prev.map((f) => (f.path === activePath ? { ...f, content: val } : f))
    );

    if (!isFileSizeValid(val)) {
      if (!file._sizeWarnShown) {
        alert(`File exceeds 2MB limit. Current size: ${getReadableFileSize(val)}. Please reduce content to save.`);
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

  // Auth handlers
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
      resetAppState();
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  // Welcome screen handlers
  const handleGetStarted = () => {
    localStorage.setItem('hasVisitedIDE', 'true');
    setShowWelcome(false);
  };
  
  const handleViewExamples = () => {
    localStorage.setItem('hasVisitedIDE', 'true');
    setShowWelcome(false);
    setActivePath('/contract/voting.rs');
  };

  // Helpers
  const fileKey = (f) => f?.id || f?.path;
  
  function getStatusForFile(f) {
    const key = fileKey(f);
    if (savingMap[key]) return { status: "saving", text: "Saving..." };
    if (errorMap[key]) return { status: "error", text: "Save error" };
    if (savedMap[key] || lastSavedMap[key]) {
      const last = lastSavedMap[key];
      const text = last ? `Saved • ${new Date(last).toLocaleString()}` : "Saved";
      return { status: "saved", text };
    }
    return { status: "idle", text: "" };
  }

  // Render
  if (loggingIn) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }
  
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
  
  if (showWelcome && user) {
    return (
      <WelcomeScreen 
        onGetStarted={handleGetStarted}
        onViewExamples={handleViewExamples}
      />
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
                title="Download current file"
              >
                ⬇️ Download
              </button>
              
              <button
                className="topbar-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file"
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
              💡 Ctrl+B: Build | Ctrl+T: Test | Ctrl+N: New
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

        <BuildPanel
          projectId={projectId}
          onBuild={handleBuild}
          onTest={handleTest}
          onDeploy={handleDeploy}
          onOpenTerminal={() => setTerminalOpen(true)}
          isBuilding={isBuilding}
          isTesting={isTesting}
          isDeploying={isDeploying}
          lastBuildStatus={lastBuildStatus}
          hasTerminalLogs={terminalLogs.length > 0}
        />

        <div className="main-content" style={{ marginBottom: terminalOpen ? '300px' : '0' }}>
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
            protectedPaths={PROTECTED_PATHS}
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

        <Terminal
          logs={terminalLogs}
          isOpen={terminalOpen}
          onClose={() => setTerminalOpen(false)}
          onClear={() => setTerminalLogs([])}
        />
      </div>
    </ErrorBoundary>
  );
}