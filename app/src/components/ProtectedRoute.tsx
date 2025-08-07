import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Spinner } from '@cloudscape-design/components';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Box textAlign="center">
          <Spinner size="large" />
          <Box margin={{ top: 'm' }}>
            Loading...
          </Box>
        </Box>
      </div>
    );
  }

  // Allow all authenticated users (including anonymous)
  return isAuthenticated ? <>{children}</> : <div>Unable to authenticate</div>;
};

export default ProtectedRoute; 