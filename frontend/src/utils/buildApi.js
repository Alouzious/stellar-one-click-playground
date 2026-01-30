// API utilities for build, test, and deploy operations

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Build the contract
 */
export async function buildContract(projectId) {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Build failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Build error:', error);
    throw error;
  }
}

/**
 * Run tests for the contract
 */
export async function testContract(projectId) {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Test failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Test error:', error);
    throw error;
  }
}

/**
 * Deploy the contract to Stellar testnet
 */
export async function deployContract(projectId, wasmBase64) {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wasm_base64: wasmBase64,
        network: 'testnet',
      }),
    });

    if (!response.ok) {
      throw new Error(`Deploy failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Deploy error:', error);
    throw error;
  }
}

/**
 * Parse build logs into structured format
 */
export function parseBuildLogs(logs) {
  if (!logs) return [];

  const lines = logs.split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('error:') || trimmed.includes('ERROR') || trimmed.includes('Failed')) {
      return { type: 'error', text: trimmed };
    }
    
    if (trimmed.startsWith('warning:') || trimmed.includes('WARNING')) {
      return { type: 'warning', text: trimmed };
    }
    
    if (trimmed.includes('✅') || trimmed.includes('Success') || trimmed.includes('Finished')) {
      return { type: 'success', text: trimmed };
    }
    
    if (trimmed.startsWith('===') || trimmed.includes('Building') || trimmed.includes('Running')) {
      return { type: 'info', text: trimmed };
    }
    
    return { type: 'default', text: trimmed };
  }).filter(log => log.text.length > 0);
}

/**
 * Get readable file size from WASM base64
 */
export function getWasmSize(wasmBase64) {
  if (!wasmBase64) return 'N/A';
  
  const bytes = atob(wasmBase64).length;
  
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Format timestamp for terminal logs
 */
export function formatLogTimestamp(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}