import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Login from "./pages/Login";
import Templates from "./pages/Templates";
import CampaignBuilder from "./pages/CampaignBuilder";
import AdsProcessing from "./pages/AdsProcessing";
import BulkUploader from "./pages/BulkUploader";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route path="/" element={<AuthGuard><Navigate to="/templates" replace /></AuthGuard>} />
            <Route path="/templates" element={<AuthGuard><Templates /></AuthGuard>} />
            <Route path="/builder" element={<AuthGuard><CampaignBuilder /></AuthGuard>} />
            <Route path="/ads-processing" element={<AuthGuard><AdsProcessing /></AuthGuard>} />
            <Route path="/bulk-uploader" element={<AuthGuard><BulkUploader /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
