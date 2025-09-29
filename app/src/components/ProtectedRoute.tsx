import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardPageTemp from '../pages/DashboardPageTemp';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardPageTemp />;
  }

  // Allow all authenticated users (including anonymous)
  return isAuthenticated ? <>{children}</> : <DashboardPageTemp />;
};

export default ProtectedRoute; 