import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import App from './App';

// No StrictMode here: its dev-only double-invoke of effects fights
// leaflet.heat's imperative layer lifecycle (setLatLngs schedules an async
// redraw via requestAnimationFrame that can outlive a StrictMode-simulated
// remove/re-add cycle) — a known class of incompatibility with imperative
// Leaflet plugins, not a real bug in production.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
