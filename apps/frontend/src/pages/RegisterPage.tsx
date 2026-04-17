import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import type { Location } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '../auth/use-auth';
import { useToast } from '../components/use-toast';

const schema = z.object({
  name: z.string().min(2, 'Введите имя'),
  email: z.string().email('Нужен валидный email'),
  phone: z.string().min(6, 'Минимум 6 символов'),
  password: z.string().min(6, 'Минимум 6 символов')
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
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
      await registerUser(values);
      toast.showSuccess('Регистрация завершена');
      navigate(redirectTo, { replace: true });
    } catch {
      toast.showError('Не удалось зарегистрироваться. Проверь данные.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at top, rgba(240, 140, 46, 0.2), transparent 55%), #f4f1eb',
        px: 2
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 460 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Регистрация
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Создай аккаунт для работы с промокодами.
            </Typography>
          </Box>
          <TextField
            label="Имя"
            fullWidth
            {...register('name')}
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            {...register('email')}
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
          />
          <TextField
            label="Телефон"
            fullWidth
            {...register('phone')}
            error={Boolean(errors.phone)}
            helperText={errors.phone?.message}
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
            Создать аккаунт
          </Button>
          <Typography variant="body2" color="text.secondary">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
