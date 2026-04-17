import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import type { Location } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '../auth/use-auth';
import { useToast } from '../components/use-toast';

const schema = z.object({
  email: z.string().email('Нужен валидный email'),
  password: z.string().min(6, 'Минимум 6 символов')
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const target = (location.state as { from?: Location } | null)?.from;
  const redirectTo = target
    ? `${target.pathname}${target.search}${target.hash}`
    : '/promocodes';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values);
      toast.showSuccess('С возвращением!');
      navigate(redirectTo, { replace: true });
    } catch {
      toast.showError('Не удалось войти. Проверь почту и пароль.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at top, rgba(29, 107, 111, 0.22), transparent 55%), #f4f1eb',
        px: 2
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Вход в систему
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Управляй промокодами и заказами в одной панели.
            </Typography>
          </Box>
          <TextField
            label="Email"
            type="email"
            fullWidth
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            {...register('password')}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />
          <Button type="submit" variant="contained" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            Войти
          </Button>
          <Typography variant="body2" color="text.secondary">
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
