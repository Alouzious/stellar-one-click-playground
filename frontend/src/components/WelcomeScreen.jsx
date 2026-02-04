import React from "react";
import "./WelcomeScreen.css";

// Professional SVG Icons
const Icons = {
  Logo: () => (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 8L8 20L32 32L56 20L32 8Z" stroke="url(#grad1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M8 44L32 56L56 44" stroke="url(#grad1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M8 32L32 44L56 32" stroke="url(#grad1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <defs>
        <linearGradient id="grad1" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#667eea"/>
          <stop offset="100%" stopColor="#764ba2"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  
  Lightning: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Hammer: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Flask: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 3H15M9 3V9L4.5 18.5C3.83 19.67 4.67 21 6 21H18C19.33 21 20.17 19.67 19.5 18.5L15 9V3M9 3H6M15 3H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="15" r="2" fill="currentColor"/>
    </svg>
  ),
  
  Rocket: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 16.5C3 14.26 3 11.74 3 9c0-5 5-9 9-9s9 4 9 9c0 2.74 0 5.26-1.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 0v9m0 0L9 6m3 3l3-3M8 16h8l-1.5 5.5c-.5 1.5-2.5 1.5-3 0L8 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  ),
  
  Save: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Book: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 7h8M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  BookOpen: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Code: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 18L22 12L16 6M8 6L2 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Star: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Sparkles: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v18m0-18L9 6m3-3l3 3M6 9h12M6 9L9 6M6 9l-3 3m15-3l3 3m-3-3l-3-3M6 15h12m-12 0l3 3m-3-3l-3 3m15-3l-3 3m3-3l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  ArrowRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  ExternalLink: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

export default function WelcomeScreen({ onGetStarted, onViewExamples }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-background">
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-grid"></div>
      </div>

      <div className="welcome-content">
        {/* Hero Section */}
        <div className="welcome-hero">
          <div className="welcome-logo">
            <div className="logo-icon-wrapper">
              <Icons.Logo />
            </div>
          </div>
          <h1 className="hero-title">
            <span className="title-gradient">Soroban IDE</span>
          </h1>
          <p className="hero-subtitle">
            Professional smart contract development for Stellar blockchain
          </p>
          <p className="hero-description">
            Write, compile, test, and deploy Soroban contracts with a powerful browser-based IDE
          </p>

          {/* CTA Buttons */}
          <div className="hero-actions">
            <button className="btn-primary" onClick={onGetStarted}>
              <span>Get Started</span>
              <Icons.ArrowRight />
            </button>
            <button className="btn-secondary" onClick={onViewExamples}>
              <Icons.Code />
              <span>View Examples</span>
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="features-section">
          <h2 className="section-title">
            <Icons.Sparkles />
            <span>Powerful Features</span>
          </h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon lightning">
                <Icons.Lightning />
              </div>
              <h3>Instant Setup</h3>
              <p>No installation required. Start coding immediately with zero configuration.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon hammer">
                <Icons.Hammer />
              </div>
              <h3>One-Click Build</h3>
              <p>Compile Rust smart contracts to optimized WASM with a single command.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon flask">
                <Icons.Flask />
              </div>
              <h3>Integrated Testing</h3>
              <p>Run comprehensive unit tests with real-time feedback and detailed logs.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon rocket">
                <Icons.Rocket />
              </div>
              <h3>Easy Deployment</h3>
              <p>Deploy contracts to Stellar testnet seamlessly with built-in tools.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon save">
                <Icons.Save />
              </div>
              <h3>Cloud Sync</h3>
              <p>Auto-save to cloud storage. Access your projects from anywhere, anytime.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon book">
                <Icons.Book />
              </div>
              <h3>Rich Examples</h3>
              <p>Learn from battle-tested contracts: tokens, voting systems, and more.</p>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="shortcuts-section">
          <h2 className="section-title">Keyboard Shortcuts</h2>
          <div className="shortcuts-grid">
            <div className="shortcut-card">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <span className="plus">+</span>
                <kbd>B</kbd>
              </div>
              <span className="shortcut-label">Build Contract</span>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <span className="plus">+</span>
                <kbd>T</kbd>
              </div>
              <span className="shortcut-label">Run Tests</span>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <span className="plus">+</span>
                <kbd>N</kbd>
              </div>
              <span className="shortcut-label">New File</span>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd>
                <span className="plus">+</span>
                <kbd>S</kbd>
              </div>
              <span className="shortcut-label">Manual Save</span>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="resources-section">
          <h2 className="section-title">Developer Resources</h2>
          <div className="resources-grid">
            <a 
              href="https://soroban.stellar.org/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="resource-card"
            >
              <div className="resource-icon">
                <Icons.BookOpen />
              </div>
              <div className="resource-content">
                <h3>Soroban Documentation</h3>
                <p>Official guides, tutorials, and API references</p>
              </div>
              <Icons.ExternalLink />
            </a>

            <a 
              href="https://github.com/stellar/soroban-examples" 
              target="_blank" 
              rel="noopener noreferrer"
              className="resource-card"
            >
              <div className="resource-icon">
                <Icons.Code />
              </div>
              <div className="resource-content">
                <h3>Example Contracts</h3>
                <p>Open-source smart contract implementations</p>
              </div>
              <Icons.ExternalLink />
            </a>

            <a 
              href="https://developers.stellar.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="resource-card"
            >
              <div className="resource-icon">
                <Icons.Star />
              </div>
              <div className="resource-content">
                <h3>Stellar Developer Hub</h3>
                <p>Complete ecosystem documentation and tools</p>
              </div>
              <Icons.ExternalLink />
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="welcome-footer">
          <div className="footer-content">
            <p>Powered by Soroban</p>
            <span className="footer-divider">•</span>
            <p>Built for the Stellar ecosystem</p>
          </div>
        </footer>
      </div>
    </div>
  );
}