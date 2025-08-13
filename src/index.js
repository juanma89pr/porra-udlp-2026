import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Si tienes este archivo, si no, puedes borrar esta línea.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);