import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { Web3Provider } from "./context/Web3Context";

// In production, requests go straight to the deployed Railway backend.
// In local dev, REACT_APP_API_URL is unset and CRA's "proxy" setting
// (frontend/package.json) forwards relative /api calls to localhost:5000.
if (process.env.REACT_APP_API_URL) {
  axios.defaults.baseURL = process.env.REACT_APP_API_URL;
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <Web3Provider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Web3Provider>
  </React.StrictMode>,
);
