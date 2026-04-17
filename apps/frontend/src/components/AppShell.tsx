import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material';

import { useAuth } from '../auth/use-auth';

const navItems = [
  { label: 'Промокоды', to: '/promocodes' },
  { label: 'Заказы', to: '/orders' },
  { label: 'Аналитика', to: '/analytics' }
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSmall = useMediaQuery('(max-width:900px)');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(240, 140, 46, 0.15), transparent 55%), radial-gradient(circle at top right, rgba(29, 107, 111, 0.18), transparent 50%), #f4f1eb',
        color: 'text.primary',
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 4 }
      }}
    >
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            gap: 2,
            alignItems: { xs: 'flex-start', md: 'center' }
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              PromoCode Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Панель управления промо-кампаниями и заказами
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {user && (
              <Chip
                label={`${user.name} · ${user.email}`}
                variant="outlined"
                sx={{ borderColor: '#dfd6c9' }}
              />
            )}
            <Button variant="contained" color="primary" onClick={handleLogout}>
              Выйти
            </Button>
          </Stack>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          gap: 3
        }}
      >
        <Paper sx={{ p: 2, height: 'fit-content' }}>
          <Stack spacing={1}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                variant={isSmall ? 'outlined' : 'text'}
                sx={(theme) => ({
                  justifyContent: 'flex-start',
                  fontWeight: 600,
                  borderRadius: 12,
                  color: 'text.primary',
                  '&[aria-current="page"]': {
                    backgroundColor: 'rgba(29, 107, 111, 0.12)',
                    borderColor: theme.palette.primary.main
                  }
                })}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Используй меню для перехода между ключевыми сценариями: промокоды, заказы, аналитика.
          </Typography>
        </Paper>

        <Box>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
