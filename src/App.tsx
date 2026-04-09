import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import Index from "./pages/Index.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="rajmandir-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/pending" element={<Index />} />
                <Route path="/done" element={<Index />} />
                <Route path="/analytics" element={<Index />} />
                <Route path="/stores" element={<Index />} />
                <Route path="/reports" element={<Index />} />
                <Route path="/settings" element={<Index />} />
                <Route path="/permissions" element={<Index />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </FeedbackProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
