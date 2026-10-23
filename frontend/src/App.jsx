import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/reconciliation" replace />} />
        <Route path="/reconciliation" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/reconciliation" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
