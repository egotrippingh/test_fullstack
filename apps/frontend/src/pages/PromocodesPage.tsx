import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Divider, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type Resolver, type SubmitHandler, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { PromoCode } from '../api/types';
import {
  createPromocode,
  deactivatePromocode,
  listPromocodes,
  updatePromocode
} from '../api/promocodes';
import { useToast } from '../components/use-toast';
import { getErrorMessage } from '../utils/api-error';
import { formatDate } from '../utils/date';

const schema = z.object({
  code: z.string().min(2, 'Код обязателен'),
  discountPercent: z.coerce.number().min(1).max(100),
  totalUsageLimit: z.coerce.number().min(0),
  perUserUsageLimit: z.coerce.number().min(0),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  code: '',
  discountPercent: 10,
  totalUsageLimit: 100,
  perUserUsageLimit: 1,
  dateFrom: '',
  dateTo: '',
  isActive: true
};

export function PromocodesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [editing, setEditing] = useState<PromoCode | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['promocodes', pagination.page, pagination.pageSize],
    queryFn: () =>
      listPromocodes({
        page: pagination.page + 1,
        pageSize: pagination.pageSize
      })
  });

  const createMutation = useMutation({
    mutationFn: createPromocode,
    onSuccess: async () => {
      toast.showSuccess('Промокод создан');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['promocodes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ]);
      setEditing(null);
    },
    onError: (error) => toast.showError(getErrorMessage(error, 'Не удалось создать промокод'))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FormValues> }) =>
      updatePromocode(id, payload),
    onSuccess: async () => {
      toast.showSuccess('Промокод обновлён');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['promocodes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ]);
      setEditing(null);
    },
    onError: (error) => toast.showError(getErrorMessage(error, 'Не удалось обновить промокод'))
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivatePromocode,
    onSuccess: async () => {
      toast.showSuccess('Промокод деактивирован');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['promocodes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ]);
    },
    onError: (error) => toast.showError(getErrorMessage(error, 'Не удалось деактивировать промокод'))
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues
  });

  useEffect(() => {
    if (editing) {
      reset({
        code: editing.code,
        discountPercent: editing.discountPercent,
        totalUsageLimit: editing.totalUsageLimit,
        perUserUsageLimit: editing.perUserUsageLimit,
        dateFrom: editing.dateFrom ? editing.dateFrom.slice(0, 10) : '',
        dateTo: editing.dateTo ? editing.dateTo.slice(0, 10) : '',
        isActive: editing.isActive
      });
    } else {
      reset(defaultValues);
    }
  }, [editing, reset]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payload = {
      ...values,
      dateFrom: values.dateFrom ? values.dateFrom : null,
      dateTo: values.dateTo ? values.dateTo : null
    };

    if (editing) {
      await updateMutation.mutateAsync({ id: editing._id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Код', flex: 1, minWidth: 120 },
    { field: 'discountPercent', headerName: 'Скидка %', width: 110 },
    { field: 'totalUsageLimit', headerName: 'Лимит общий', width: 130 },
    { field: 'perUserUsageLimit', headerName: 'Лимит на пользователя', width: 170 },
    { field: 'usedCount', headerName: 'Использований', width: 130 },
    {
      field: 'isActive',
      headerName: 'Статус',
      width: 110,
        valueFormatter: (value) => (value ? 'Активен' : 'Отключён')
      },
    {
      field: 'dateFrom',
      headerName: 'С даты',
      width: 130,
        valueFormatter: (value) => formatDate(value as string)
      },
    {
      field: 'dateTo',
      headerName: 'До даты',
      width: 130,
        valueFormatter: (value) => formatDate(value as string)
      },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={(event) => {
            event.stopPropagation();
            deactivateMutation.mutate(params.row._id);
          }}
          disabled={!params.row.isActive || deactivateMutation.isPending}
        >
          Деактивировать
        </Button>
      )
    }
  ];

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {editing ? 'Редактирование промокода' : 'Новый промокод'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Задай правила скидки, сроки действия и лимиты использования.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Код"
              fullWidth
              {...register('code')}
              error={Boolean(errors.code)}
              helperText={errors.code?.message}
            />
            <TextField
              label="Скидка %"
              type="number"
              {...register('discountPercent')}
              error={Boolean(errors.discountPercent)}
              helperText={errors.discountPercent?.message}
            />
            <TextField
              label="Лимит общий"
              type="number"
              {...register('totalUsageLimit')}
              error={Boolean(errors.totalUsageLimit)}
              helperText={errors.totalUsageLimit?.message}
            />
            <TextField
              label="Лимит на пользователя"
              type="number"
              {...register('perUserUsageLimit')}
              error={Boolean(errors.perUserUsageLimit)}
              helperText={errors.perUserUsageLimit?.message}
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              label="Дата начала"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('dateFrom')}
            />
            <TextField
              label="Дата окончания"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('dateTo')}
            />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Switch {...register('isActive')} />
              <Typography variant="body2">Активен</Typography>
            </Stack>
          </Stack>
          <Divider />
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setEditing(null)}
              disabled={!editing}
            >
              Сбросить
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Список промокодов
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
            onRowClick={(params) => setEditing(params.row as PromoCode)}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            autoHeight
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
