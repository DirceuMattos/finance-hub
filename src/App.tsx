import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Lancamentos from "./pages/Lancamentos";
import Recorrencias from "./pages/Recorrencias";
import Cartoes from "./pages/Cartoes";
import FaturasProjetadas from "./pages/FaturasProjetadas";
import FluxoMensal from "./pages/FluxoMensal";
import Configuracoes from "./pages/Configuracoes";
import Patrimonio from "./pages/Patrimonio";
import Investimentos from "./pages/Investimentos";
import Relatorios from "./pages/Relatorios";
import Alertas from "./pages/Alertas";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/alertas" element={<ProtectedRoute><Alertas /></ProtectedRoute>} />
          <Route path="/lancamentos" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
          <Route path="/recorrencias" element={<ProtectedRoute><Recorrencias /></ProtectedRoute>} />
          <Route path="/cartoes" element={<ProtectedRoute><Cartoes /></ProtectedRoute>} />
          <Route path="/faturas-projetadas" element={<ProtectedRoute><FaturasProjetadas /></ProtectedRoute>} />
          <Route path="/fluxo-mensal" element={<ProtectedRoute><FluxoMensal /></ProtectedRoute>} />
          <Route path="/patrimonio" element={<ProtectedRoute><Patrimonio /></ProtectedRoute>} />
          <Route path="/investimentos" element={<ProtectedRoute><Investimentos /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
