import { Box, CircularProgress } from '@mui/material';
import type { Location } from 'react-router-dom';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/use-auth';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const target = (location.state as { from?: Location } | null)?.from;
  const redirectTo = target
    ? `${target.pathname}${target.search}${target.hash}`
    : '/promocodes';

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
