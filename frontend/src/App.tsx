/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { FavoritesProvider } from './context/FavoritesContext.js';
import { ComparisonProvider } from './context/ComparisonContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { AgroAssistant } from './components/AgroAssistant.js';

import { HomePage } from './pages/HomePage.js';
import { OpportunitiesPage } from './pages/OpportunitiesPage.js';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage.js';
import { InteractiveMapPage } from './pages/InteractiveMapPage.js';
import { ComparePage } from './pages/ComparePage.js';
import { AgroMatchPage } from './pages/AgroMatchPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { EntrepreneurDashboardPage } from './pages/EntrepreneurDashboardPage.js';
import { AdminDashboardPage } from './pages/AdminDashboardPage.js';
import { ApplicationWizardPage } from './pages/ApplicationWizardPage.js';
import { LandSubmitPage } from './pages/LandSubmitPage.js';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [currentSearch, setCurrentSearch] = useState(() => window.location.search || '');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setCurrentSearch(window.location.search || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    const [path, search] = to.split('?');
    window.history.pushState(null, '', to);
    setCurrentPath(path || '/');
    setCurrentSearch(search ? `?${search}` : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route matching
  const renderRoute = () => {
    if (currentPath === '/') {
      return <HomePage navigate={navigate} />;
    }

    if (currentPath === '/opportunities') {
      return <OpportunitiesPage navigate={navigate} initialQuery={currentSearch} />;
    }

    if (currentPath.startsWith('/opportunities/')) {
      const id = currentPath.replace('/opportunities/', '');
      return <OpportunityDetailPage id={id} navigate={navigate} />;
    }

    if (currentPath === '/map') {
      return <InteractiveMapPage navigate={navigate} />;
    }

    if (currentPath === '/compare') {
      return <ComparePage navigate={navigate} />;
    }

    if (currentPath === '/agromatch') {
      return <AgroMatchPage navigate={navigate} />;
    }

    if (currentPath === '/login') {
      return <AuthPage initialMode="login" navigate={navigate} />;
    }

    if (currentPath === '/register') {
      return <AuthPage initialMode="register" navigate={navigate} />;
    }

    if (currentPath === '/dashboard' || currentPath.startsWith('/dashboard/')) {
      return <EntrepreneurDashboardPage navigate={navigate} />;
    }

    if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
      return <AdminDashboardPage navigate={navigate} />;
    }

    // Investor proposal form ("/applications/new/" kept so old links still work)
    if (currentPath.startsWith('/proposals/new/') || currentPath.startsWith('/applications/new/')) {
      const oppId = currentPath.replace('/proposals/new/', '').replace('/applications/new/', '');
      return <ApplicationWizardPage opportunityId={oppId} navigate={navigate} />;
    }

    // Owner: submit land for review
    if (currentPath === '/lands/new') {
      return <LandSubmitPage navigate={navigate} />;
    }

    // Default fallback to HomePage
    return <HomePage navigate={navigate} />;
  };

  return (
    <AuthProvider>
      <FavoritesProvider>
        <ComparisonProvider>
          <div className="min-h-screen flex flex-col bg-cream text-ink">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:text-brand-900 focus:font-bold focus:px-5 focus:py-3 focus:rounded-xl">
              Əsas məzmuna keç
            </a>
            <Header currentRoute={currentPath} navigate={navigate} />
            <main id="main" className="flex-1">
              {renderRoute()}
            </main>
            <Footer navigate={navigate} />
            <AgroAssistant navigate={navigate} currentRoute={currentPath} />
          </div>
        </ComparisonProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
