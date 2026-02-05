import React, { useEffect, useState } from 'react';
import './OperationProgress.css';

export default function OperationProgress({ 
  operation = null, // 'build', 'test', 'deploy', null
  onClose 
}) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [substep, setSubstep] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Progress steps for each operation type
  const operationSteps = {
    build: [
      { progress: 10, step: 'Preparing workspace', substep: 'Creating temporary directory...' },
      { progress: 20, step: 'Loading files', substep: 'Fetching project files from database...' },
      { progress: 35, step: 'Starting Docker container', substep: 'Initializing build environment...' },
      { progress: 50, step: 'Compiling Rust code', substep: 'Running cargo build --release...' },
      { progress: 70, step: 'Generating WASM', substep: 'Building for wasm32-unknown-unknown target...' },
      { progress: 85, step: 'Optimizing binary', substep: 'Reducing WASM size...' },
      { progress: 95, step: 'Validating output', substep: 'Checking WASM integrity...' },
      { progress: 100, step: 'Build complete!', substep: 'Contract ready for deployment' },
    ],
    test: [
      { progress: 10, step: 'Preparing test environment', substep: 'Setting up workspace...' },
      { progress: 25, step: 'Loading test files', substep: 'Fetching project and test files...' },
      { progress: 40, step: 'Starting Docker container', substep: 'Initializing test runner...' },
      { progress: 55, step: 'Running unit tests', substep: 'Executing cargo test...' },
      { progress: 70, step: 'Running integration tests', substep: 'Testing contract functions...' },
      { progress: 85, step: 'Collecting results', substep: 'Analyzing test output...' },
      { progress: 95, step: 'Generating report', substep: 'Compiling test results...' },
      { progress: 100, step: 'Tests complete!', substep: 'All tests executed successfully' },
    ],
    deploy: [
      { progress: 10, step: 'Preparing deployment', substep: 'Validating WASM binary...' },
      { progress: 20, step: 'Starting Docker container', substep: 'Initializing deployment environment...' },
      { progress: 35, step: 'Generating identity', substep: 'Creating deployer keypair...' },
      { progress: 50, step: 'Funding account', substep: 'Requesting testnet XLM from Friendbot...' },
      { progress: 60, step: 'Waiting for funding', substep: 'Confirming account balance...' },
      { progress: 75, step: 'Uploading contract', substep: 'Submitting WASM to Stellar network...' },
      { progress: 85, step: 'Installing contract', substep: 'Deploying to testnet...' },
      { progress: 95, step: 'Verifying deployment', substep: 'Confirming contract ID...' },
      { progress: 100, step: 'Deployment complete!', substep: 'Contract is live on testnet!' },
    ],
  };

  useEffect(() => {
    if (!operation) {
      setProgress(0);
      setStep('');
      setSubstep('');
      setIsComplete(false);
      return;
    }

    const steps = operationSteps[operation] || [];
    let currentStepIndex = 0;
    setIsComplete(false);

    // Simulate progress through steps
    const interval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        const currentStep = steps[currentStepIndex];
        setProgress(currentStep.progress);
        setStep(currentStep.step);
        setSubstep(currentStep.substep);
        
        if (currentStep.progress === 100) {
          setIsComplete(true);
        }
        
        currentStepIndex++;
      } else {
        clearInterval(interval);
      }
    }, operation === 'build' ? 1500 : operation === 'test' ? 2000 : 1800);

    return () => clearInterval(interval);
  }, [operation]);

  if (!operation && progress === 0) return null;

  const getOperationIcon = () => {
    switch (operation) {
      case 'build': return '🔨';
      case 'test': return '🧪';
      case 'deploy': return '🚀';
      default: return '⚙️';
    }
  };

  const getOperationTitle = () => {
    switch (operation) {
      case 'build': return 'Building Contract';
      case 'test': return 'Running Tests';
      case 'deploy': return 'Deploying to Stellar';
      default: return 'Processing';
    }
  };

  const getOperationColor = () => {
    switch (operation) {
      case 'build': return '#007acc';
      case 'test': return '#4caf50';
      case 'deploy': return '#9c27b0';
      default: return '#007acc';
    }
  };

  return (
    <div className="operation-progress-overlay">
      <div className="operation-progress-modal">
        <div className="operation-progress-header" style={{ borderLeftColor: getOperationColor() }}>
          <div className="operation-title-area">
            <span className="operation-icon">{getOperationIcon()}</span>
            <h3>{getOperationTitle()}</h3>
          </div>
          {isComplete && (
            <button className="close-btn" onClick={onClose}>✕</button>
          )}
        </div>
        
        <div className="operation-progress-content">
          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${getOperationColor()}, ${getOperationColor()}dd)`
              }}
            >
              <span className="progress-bar-text">{progress}%</span>
            </div>
          </div>
          
          {/* Current Step */}
          <div className="progress-steps">
            <div className="progress-step-main">
              {isComplete ? '✅' : '⏳'} {step}
            </div>
            <div className="progress-step-sub">
              {substep}
            </div>
          </div>
          
          {/* Animation */}
          <div className="progress-animation">
            {!isComplete ? (
              <div className="spinner-container">
                <div className="spinner-ring" style={{ borderTopColor: getOperationColor() }}></div>
                <div className="spinner-ring" style={{ borderTopColor: getOperationColor() }}></div>
                <div className="spinner-ring" style={{ borderTopColor: getOperationColor() }}></div>
              </div>
            ) : (
              <div className="success-checkmark" style={{ color: getOperationColor() }}>
                ✓
              </div>
            )}
          </div>
          
          {/* Progress Details */}
          <div className="progress-details">
            <div className="progress-detail-item">
              <span className="detail-label">Operation:</span>
              <span className="detail-value">{operation?.toUpperCase()}</span>
            </div>
            <div className="progress-detail-item">
              <span className="detail-label">Status:</span>
              <span className="detail-value">{isComplete ? 'Complete' : 'In Progress'}</span>
            </div>
            <div className="progress-detail-item">
              <span className="detail-label">Progress:</span>
              <span className="detail-value">{progress}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}