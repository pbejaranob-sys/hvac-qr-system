import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RegistrarEquipo from "./pages/RegistrarEquipo";
import VistaEquipo from "./pages/VistaEquipo";
import PanelCliente from "./pages/PanelCliente";
import PanelAdmin from "./pages/PanelAdmin";
import CrearUsuario from "./pages/CrearUsuario";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/registrar" element={<RegistrarEquipo />} />
        <Route path="/equipo/:id" element={<VistaEquipo />} />
        <Route path="/cliente" element={<PanelCliente />} />
        <Route path="/admin" element={<PanelAdmin />} />
        <Route path="/crear-usuario" element={<CrearUsuario />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;