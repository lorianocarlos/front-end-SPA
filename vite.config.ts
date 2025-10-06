// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Certifique-se de que este está aqui!

export default defineConfig({
  plugins: [react()],
  
  // Foco nesta seção para resolver o erro 'undefined'
  server: {
    // 1. Defina a porta de desenvolvimento do servidor (corresponde a http://localhost:5173)
    port: 5173, 
    
    // 2. Garanta que o Vite use esta porta para a conexão HMR (WebSocket)
    // Isso é especialmente útil se você estiver usando um proxy reverso ou Docker, 
    // mas pode corrigir o problema de 'undefined' mesmo em desenvolvimento local.
    hmr: {
      host: 'localhost',
      port: 5173, // Esta linha é a mais provável de corrigir o 'undefined'
    }
  }
});