import React, { useState } from "react";
import FileSidebar from "./components/FileSidebar";
import ContractEditor from "./components/ContractEditor";
import "./App.css";

const initialFiles = [
  {
    name: "lib.rs",
    path: "/src/lib.rs",
    language: "rust",
    content: `#![no_std]
use soroban_sdk::*;

#[contracttype]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello() -> &'static str {
        "Hello, Soroban!"
    }
}
`
  },
  {
    name: "Cargo.toml",
    path: "/Cargo.toml",
    language: "toml",
    content: `[package]
name = "hello_soroban"
version = "0.1.0"
edition = "2021"

[dependencies]
soroban-sdk = "21.7.7"
`
  }
];

export default function App() {
  const [files, setFiles] = useState(initialFiles);
  const [activePath, setActivePath] = useState(files[0].path);
  const activeFile = files.find(f => f.path === activePath);

  // New file handler
  const handleNewFile = () => {
    let name = prompt("New file name (e.g. test.rs, README.md):");
    if (!name) return;
    name = name.trim();
    if (!name.match(/^[\w\-\.]+$/)) {
      alert("Invalid file name.");
      return;
    }
    if (files.find(f => f.name === name)) {
      alert("File name already exists!");
      return;
    }
    const lang =
      name.endsWith(".rs") ? "rust" :
      name.endsWith(".toml") ? "toml" :
      name.endsWith(".md") ? "markdown" :
      name.endsWith(".json") ? "json" : "plaintext";
    const path = "/src/" + name;
    setFiles([...files, { name, path, language: lang, content: "" }]);
    setActivePath(path);
  };

  // Delete file handler
  const handleDeleteFile = (path) => {
    if (window.confirm("Delete this file?")) {
      const idx = files.findIndex(f => f.path === path);
      const newFiles = files.filter(f => f.path !== path);
      setFiles(newFiles);
      // Switch active to a file above, if needed
      if (activePath === path) {
        setActivePath(newFiles[Math.max(0, idx - 1)].path);
      }
    }
  };

  // Rename file handler
  const handleRenameFile = (oldPath) => {
    const file = files.find(f => f.path === oldPath);
    let newName = prompt("Rename file to:", file.name);
    if (!newName || newName === file.name) return;
    if (!newName.match(/^[\w\-\.]+$/)) {
      alert("Invalid file name.");
      return;
    }
    if (files.find(f => f.name === newName)) {
      alert("File name already exists!");
      return;
    }
    const newPath = "/src/" + newName;
    const lang =
      newName.endsWith(".rs") ? "rust" :
      newName.endsWith(".toml") ? "toml" :
      newName.endsWith(".md") ? "markdown" :
      newName.endsWith(".json") ? "json" : "plaintext";
    setFiles(files.map(f => f.path === oldPath ?
      { ...f, name: newName, path: newPath, language: lang }
      : f));
    if (activePath === oldPath) setActivePath(newPath);
  };

  const onChange = (val) => {
    setFiles(files =>
      files.map(f =>
        f.path === activePath ? { ...f, content: val } : f
      )
    );
  };

  return (
    <div className="app-container">
      <FileSidebar
        files={files}
        activePath={activePath}
        setActivePath={setActivePath}
        onNewFile={handleNewFile}
        onDeleteFile={handleDeleteFile}
        onRenameFile={handleRenameFile}
      />
      <ContractEditor
        file={activeFile}
        onChange={onChange}
      />
    </div>
  );
}