import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./components/app-layout.tsx";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import LogPage from "./pages/log/page.tsx";
import NotFound from "./pages/NotFound.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import StockInPage from "./pages/stock-in/page.tsx";
import StockOutPage from "./pages/stock-out/page.tsx";
import UsersPage from "./pages/users/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/stock-in" element={<StockInPage />} />
            <Route path="/stock-out" element={<StockOutPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/log" element={<LogPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
