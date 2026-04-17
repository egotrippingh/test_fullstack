import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type Resolver, type SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyPromoCode, createOrder, listMyOrders } from '../api/orders';
import type { Order } from '../api/types';
import { useToast } from '../components/use-toast';
import { getErrorMessage } from '../utils/api-error';
import { formatDate } from '../utils/date';

const createSchema = z.object({
  amount: z.coerce.number().min(1, 'Сумма должна быть положительной'),
  promoCode: z.string().trim().max(64, 'Промокод слишком длинный').optional()
});

type CreateValues = z.infer<typeof createSchema>;

export function OrdersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [applyTarget, setApplyTarget] = useState<Order | null>(null);
  const [promoCode, setPromoCode] = useState('');

  const handleCloseApply = () => {
    setApplyTarget(null);
    setPromoCode('');
  };

  const refreshOrdersAndAnalytics = async () => {
    setPagination((current) => (current.page === 0 ? current : { ...current, page: 0 }));

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    ]);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['orders', pagination.page, pagination.pageSize],
    queryFn: () =>
      listMyOrders({
        page: pagination.page + 1,
        pageSize: pagination.pageSize
      })
  });

  const createMutation = useMutation({
    mutationFn: createOrder
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, promo }: { id: string; promo: string }) =>
      applyPromoCode(id, { promoCode: promo })
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema) as unknown as Resolver<CreateValues>
  });

  const onSubmit: SubmitHandler<CreateValues> = async (values) => {
    const normalizedPromoCode = values.promoCode?.trim().toUpperCase();

    try {
      const order = await createMutation.mutateAsync({ amount: values.amount });

      if (normalizedPromoCode) {
        try {
          await applyMutation.mutateAsync({ id: order._id, promo: normalizedPromoCode });
          await refreshOrdersAndAnalytics();
          reset();
          toast.showSuccess(`Заказ создан, промокод ${normalizedPromoCode} применён`);
          return;
        } catch (error) {
          await refreshOrdersAndAnalytics();
          setApplyTarget(order);
          setPromoCode(normalizedPromoCode);
          reset();
          toast.showError(
            `Заказ создан, но промокод не применён: ${getErrorMessage(
              error,
              'проверь код и попробуй снова'
            )}`
          );
          return;
        }
      }

      await refreshOrdersAndAnalytics();
      reset();
      toast.showSuccess('Заказ создан');
    } catch (error) {
      toast.showError(getErrorMessage(error, 'Не удалось создать заказ'));
    }
  };

  const handleApplyPromo = async () => {
    if (!applyTarget) {
      return;
    }

    try {
      await applyMutation.mutateAsync({ id: applyTarget._id, promo: promoCode.trim().toUpperCase() });
      await refreshOrdersAndAnalytics();
      toast.showSuccess('Промокод применён');
      handleCloseApply();
    } catch (error) {
      toast.showError(getErrorMessage(error, 'Не удалось применить промокод'));
    }
  };

  const columns: GridColDef[] = [
    { field: '_id', headerName: 'ID', width: 220 },
    { field: 'amount', headerName: 'Сумма', width: 110 },
    { field: 'discountAmount', headerName: 'Скидка', width: 110 },
    { field: 'finalAmount', headerName: 'Итог', width: 110 },
    { field: 'promoCodeCode', headerName: 'Промокод', width: 140 },
    {
      field: 'createdAt',
      headerName: 'Создан',
      width: 140,
      valueFormatter: (value) => formatDate(value as string)
    },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setApplyTarget(params.row as Order);
            setPromoCode(params.row.promoCodeCode ?? '');
          }}
          disabled={Boolean(params.row.promoCodeId)}
        >
          Применить
        </Button>
      )
    }
  ];

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Новый заказ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Создай заказ и при необходимости укажи промокод сразу. Если нужно, тот же код можно
                применить позже кнопкой в строке заказа.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
              <TextField
                label="Сумма заказа"
                type="number"
                {...register('amount')}
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message}
              />
              <TextField
                label="Промокод"
                placeholder="Например, SAVE10"
                {...register('promoCode')}
                error={Boolean(errors.promoCode)}
                helperText={errors.promoCode?.message ?? 'Необязательно'}
              />
              <Button
                variant="contained"
                type="submit"
                disabled={isSubmitting || createMutation.isPending || applyMutation.isPending}
              >
                Создать заказ
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Мои заказы
          </Typography>
          <DataGrid
            rows={data?.data ?? []}
            getRowId={(row) => row._id}
            columns={columns}
            paginationMode="server"
            rowCount={data?.meta.total ?? 0}
            loading={isLoading}
            paginationModel={pagination}
            onPaginationModelChange={setPagination}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            autoHeight
          />
        </Stack>
      </Paper>

      <Dialog open={Boolean(applyTarget)} onClose={handleCloseApply} maxWidth="xs" fullWidth>
        <DialogTitle>Применить промокод</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Заказ: {applyTarget?._id}
            </Typography>
            <TextField
              label="Промокод"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseApply}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleApplyPromo}
            disabled={!promoCode.trim() || applyMutation.isPending}
          >
            Применить
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
