import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthGate} from './AuthGate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><AuthGate /></BrowserRouter>);
