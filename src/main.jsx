import React from 'react';
import { createRoot } from 'react-dom/client';
import SiteShell from './SiteShell';
import './styles.css';
import './design-tokens.css';
import './obsidian.css';
import './enhancements.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><SiteShell /></React.StrictMode>);
