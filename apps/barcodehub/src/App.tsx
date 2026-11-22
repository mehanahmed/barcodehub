import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { useSeo } from './lib/seo';
import { notFoundSeo } from './lib/seoData';
import Landing from './pages/Landing';
import Lookup from './pages/Lookup';
import ProductPage from './pages/ProductPage';
import BrandPage from './pages/BrandPage';
import Login from './pages/Login';
import AuthGate from './components/AuthGate';
import TenantLayout from './tenant/TenantLayout';
import Dashboard from './tenant/Dashboard';
import Products from './tenant/Products';
import ProductEditor from './tenant/ProductEditor';
import Analytics from './tenant/Analytics';
import Subscription from './tenant/Subscription';
import Settings from './tenant/Settings';
import Profile from './tenant/Profile';
import Labels from './tenant/Labels';
import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/AdminLogin';
import AdminOverview from './admin/AdminOverview';
import AdminTenants from './admin/AdminTenants';
import AdminPayments from './admin/AdminPayments';
import AdminPackages from './admin/AdminPackages';
import AdminAdmins from './admin/AdminAdmins';

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function NotFound() {
  useSeo(notFoundSeo(window.location.pathname));
  return (
    <div className="min-h-screen grid place-items-center text-center">
      <div><div className="text-6xl font-extrabold text-primary">404</div><p className="text-muted-foreground mt-2">Page not found</p>
        <Button className="mt-6" asChild><Link to="/">Go home</Link></Button></div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/barcode/:number" element={<ProductPage />} />
          <Route path="/brand/:slug" element={<BrandPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/login/*" element={<Login />} />
          <Route path="/auth/signup" element={<Login />} />
          <Route path="/auth/*" element={<Navigate to="/auth/login" replace />} />
          <Route path="/app" element={<AuthGate><TenantLayout /></AuthGate>}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductEditor key="new" />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="labels" element={<Labels />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AuthGate loginPath="/admin/login"><AdminLayout /></AuthGate>}>
            <Route index element={<AdminOverview />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="packages" element={<AdminPackages />} />
            <Route path="admins" element={<AdminAdmins />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
