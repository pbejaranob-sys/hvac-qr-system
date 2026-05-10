import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RegistrarEquipo from "./pages/RegistrarEquipo";
import VistaEquipo from "./pages/VistaEquipo";
import PanelCliente from "./pages/PanelCliente";
import PanelAdmin from "./pages/PanelAdmin";
import CrearUsuario from "./pages/CrearUsuario";
import Cotizacion from "./pages/Cotizacion";
import ListaEquiposCliente from "./pages/ListaEquiposCliente";
import VistaCliente from "./pages/VistaCliente";
import PanelAdminNormal from "./pages/PanelAdminNormal";
import CrearCliente from "./pages/CrearCliente";
import VistaSede from "./pages/VistaSede";
import EditarCliente from "./pages/EditarCliente";
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
    <Route path="/admin/cliente/:clienteNombre" element={<ListaEquiposCliente />} />
    <Route path="/crear-usuario" element={<CrearUsuario />} />
    <Route path="/panel-admin" element={<PanelAdminNormal />} />
    <Route path="/crear-cliente" element={<CrearCliente />} />
    <Route path="/cliente/:clienteNombre" element={<VistaCliente />} />
    <Route path="/cotizacion/:id" element={<Cotizacion />} />
    <Route path="/cliente/:clienteNombre/sede/:sedeNombre" element={<VistaSede />} />
    <Route path="/editar-cliente/:clienteId" element={<EditarCliente />} />
  </Routes>
</BrowserRouter>
  );
}
export default App;