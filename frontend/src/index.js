import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { Web3Provider } from "./context/Web3Context";

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
