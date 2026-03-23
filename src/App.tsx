import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Lancamentos from "./pages/Lancamentos";
import Recorrencias from "./pages/Recorrencias";
import Cartoes from "./pages/Cartoes";
import ComprasCartao from "./pages/ComprasCartao";
import FaturasProjetadas from "./pages/FaturasProjetadas";
import FluxoMensal from "./pages/FluxoMensal";
import Configuracoes from "./pages/Configuracoes";
import Patrimonio from "./pages/Patrimonio";
import Investimentos from "./pages/Investimentos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/recorrencias" element={<Recorrencias />} />
          <Route path="/cartoes" element={<Cartoes />} />
          <Route path="/compras-cartao" element={<ComprasCartao />} />
          <Route path="/faturas-projetadas" element={<FaturasProjetadas />} />
          <Route path="/fluxo-mensal" element={<FluxoMensal />} />
          <Route path="/patrimonio" element={<Patrimonio />} />
          <Route path="/investimentos" element={<Investimentos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
