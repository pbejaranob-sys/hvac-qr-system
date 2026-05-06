import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RegistrarEquipo from "./pages/RegistrarEquipo";
import VistaEquipo from "./pages/VistaEquipo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/registrar" element={<RegistrarEquipo />} />
        <Route path="/equipo/:id" element={<VistaEquipo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;