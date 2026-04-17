import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel
} from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  fetchPromoUsages,
  fetchPromocodesAnalytics,
  fetchUsersAnalytics
} from '../api/analytics';
import type {
  PromoUsageRow,
  PromocodesAnalyticsRow,
  UsersAnalyticsRow
} from '../api/types';
import { addDays, formatDate, toDateInputValue } from '../utils/date';

type AnalyticsTab = 'users' | 'promocodes' | 'promo-usages';
type StatusFilter = 'all' | 'active' | 'inactive';

type UsersFilters = {
  email: string;
  name: string;
  phone: string;
  status: StatusFilter;
};

type PromoFilters = {
  code: string;
  status: StatusFilter;
};

type UsageFilters = {
  promoCode: string;
  userEmail: string;
  userName: string;
};

const defaultUsersFilters: UsersFilters = {
  email: '',
  name: '',
  phone: '',
  status: 'all'
};

const defaultPromoFilters: PromoFilters = {
  code: '',
  status: 'all'
};

const defaultUsageFilters: UsageFilters = {
  promoCode: '',
  userEmail: '',
  userName: ''
};

export function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('users');
  const [dateFrom, setDateFrom] = useState(toDateInputValue(addDays(new Date(), -30)));
  const [dateTo, setDateTo] = useState(toDateInputValue(new Date()));
  const [usersPagination, setUsersPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [promoPagination, setPromoPagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [usagePagination, setUsagePagination] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10
  });
  const [usersSort, setUsersSort] = useState<GridSortModel>([]);
  const [promoSort, setPromoSort] = useState<GridSortModel>([]);
  const [usageSort, setUsageSort] = useState<GridSortModel>([]);
  const [usersFilters, setUsersFilters] = useState<UsersFilters>(defaultUsersFilters);
  const [promoFilters, setPromoFilters] = useState<PromoFilters>(defaultPromoFilters);
  const [usageFilters, setUsageFilters] = useState<UsageFilters>(defaultUsageFilters);

  useEffect(() => {
    setUsersPagination((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [
    dateFrom,
    dateTo,
    usersFilters.email,
    usersFilters.name,
    usersFilters.phone,
    usersFilters.status
  ]);

  useEffect(() => {
    setPromoPagination((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [dateFrom, dateTo, promoFilters.code, promoFilters.status]);

  useEffect(() => {
    setUsagePagination((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [dateFrom, dateTo, usageFilters.promoCode, usageFilters.userEmail, usageFilters.userName]);

  const usersQuery = useQuery({
    queryKey: ['analytics', 'users', usersPagination, usersSort, dateFrom, dateTo, usersFilters],
    queryFn: () =>
      fetchUsersAnalytics({
        page: usersPagination.page + 1,
        pageSize: usersPagination.pageSize,
        dateFrom,
        dateTo,
        sortBy: usersSort[0]?.field,
        sortOrder: usersSort[0]?.sort ?? undefined,
        email: usersFilters.email || undefined,
        name: usersFilters.name || undefined,
        phone: usersFilters.phone || undefined,
        status: toStatusParam(usersFilters.status)
      }),
    enabled: tab === 'users'
  });

  const promoQuery = useQuery({
    queryKey: ['analytics', 'promocodes', promoPagination, promoSort, dateFrom, dateTo, promoFilters],
    queryFn: () =>
      fetchPromocodesAnalytics({
        page: promoPagination.page + 1,
        pageSize: promoPagination.pageSize,
        dateFrom,
        dateTo,
        sortBy: promoSort[0]?.field,
        sortOrder: promoSort[0]?.sort ?? undefined,
        code: promoFilters.code || undefined,
        status: toStatusParam(promoFilters.status)
      }),
    enabled: tab === 'promocodes'
  });

  const usageQuery = useQuery({
    queryKey: ['analytics', 'promo-usages', usagePagination, usageSort, dateFrom, dateTo, usageFilters],
    queryFn: () =>
      fetchPromoUsages({
        page: usagePagination.page + 1,
        pageSize: usagePagination.pageSize,
        dateFrom,
        dateTo,
        sortBy: usageSort[0]?.field,
        sortOrder: usageSort[0]?.sort ?? undefined,
        promoCode: usageFilters.promoCode || undefined,
        userEmail: usageFilters.userEmail || undefined,
        userName: usageFilters.userName || undefined
      }),
    enabled: tab === 'promo-usages'
  });

  const usersColumns: GridColDef<UsersAnalyticsRow>[] = [
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
    { field: 'name', headerName: 'Имя', width: 140 },
    { field: 'phone', headerName: 'Телефон', width: 140 },
    {
      field: 'is_active',
      headerName: 'Статус',
      width: 110,
      valueFormatter: (value) => (value ? 'Активен' : 'Отключён')
    },
    { field: 'orders_count', headerName: 'Заказов', width: 110 },
    {
      field: 'total_spent',
      headerName: 'Выручка',
      width: 120,
      valueFormatter: (value) => value ?? 0
    },
    {
      field: 'total_discount',
      headerName: 'Скидка',
      width: 120,
      valueFormatter: (value) => value ?? 0
    },
    { field: 'promo_usages', headerName: 'Использований', width: 130 }
  ];

  const promoColumns: GridColDef<PromocodesAnalyticsRow>[] = [
    { field: 'code', headerName: 'Код', flex: 1, minWidth: 120 },
    { field: 'discount_percent', headerName: 'Скидка %', width: 120 },
    {
      field: 'is_active',
      headerName: 'Статус',
      width: 110,
      valueFormatter: (value) => (value ? 'Активен' : 'Отключён')
    },
    { field: 'usages', headerName: 'Использований', width: 130 },
    {
      field: 'revenue',
      headerName: 'Выручка',
      width: 120,
      valueFormatter: (value) => value ?? 0
    },
    {
      field: 'total_discount',
      headerName: 'Скидка',
      width: 120,
      valueFormatter: (value) => value ?? 0
    },
    { field: 'unique_users', headerName: 'Пользователей', width: 140 }
  ];

  const usageColumns: GridColDef<PromoUsageRow>[] = [
    { field: 'promo_code', headerName: 'Промокод', width: 130 },
    { field: 'user_email', headerName: 'Email', flex: 1, minWidth: 180 },
    { field: 'user_name', headerName: 'Имя', width: 140 },
    { field: 'order_amount', headerName: 'Сумма', width: 120 },
    { field: 'discount_amount', headerName: 'Скидка', width: 120 },
    {
      field: 'created_at',
      headerName: 'Дата',
      width: 140,
      valueFormatter: (value) => formatDate(value as string)
    }
  ];

  const applyPreset = (days: number) => {
    const now = new Date();
    setDateTo(toDateInputValue(now));
    setDateFrom(toDateInputValue(addDays(now, -days)));
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Аналитика
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ClickHouse-данные по пользователям, промокодам и использованию.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              label="Дата от"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <TextField
              label="Дата до"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => applyPreset(0)}>
                Сегодня
              </Button>
              <Button variant="outlined" onClick={() => applyPreset(7)}>
                7 дней
              </Button>
              <Button variant="outlined" onClick={() => applyPreset(30)}>
                30 дней
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value as AnalyticsTab)} sx={{ mb: 2 }}>
          <Tab label="Пользователи" value="users" />
          <Tab label="Промокоды" value="promocodes" />
          <Tab label="История применений" value="promo-usages" />
        </Tabs>

        {tab === 'users' && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Email"
                value={usersFilters.email}
                onChange={(event) =>
                  setUsersFilters((current) => ({ ...current, email: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Имя"
                value={usersFilters.name}
                onChange={(event) =>
                  setUsersFilters((current) => ({ ...current, name: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Телефон"
                value={usersFilters.phone}
                onChange={(event) =>
                  setUsersFilters((current) => ({ ...current, phone: event.target.value }))
                }
                fullWidth
              />
              <TextField
                select
                label="Статус"
                value={usersFilters.status}
                onChange={(event) =>
                  setUsersFilters((current) => ({
                    ...current,
                    status: event.target.value as StatusFilter
                  }))
                }
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="inactive">Отключённые</MenuItem>
              </TextField>
              <Button variant="text" onClick={() => setUsersFilters(defaultUsersFilters)}>
                Сбросить
              </Button>
            </Stack>

            <DataGrid
              rows={usersQuery.data?.data ?? []}
              getRowId={(row) => row.user_id}
              columns={usersColumns}
              paginationMode="server"
              sortingMode="server"
              rowCount={usersQuery.data?.meta.total ?? 0}
              loading={usersQuery.isLoading}
              paginationModel={usersPagination}
              onPaginationModelChange={setUsersPagination}
              sortModel={usersSort}
              onSortModelChange={setUsersSort}
              pageSizeOptions={[5, 10, 20]}
              autoHeight
            />
          </Stack>
        )}

        {tab === 'promocodes' && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Код"
                value={promoFilters.code}
                onChange={(event) =>
                  setPromoFilters((current) => ({ ...current, code: event.target.value }))
                }
                fullWidth
              />
              <TextField
                select
                label="Статус"
                value={promoFilters.status}
                onChange={(event) =>
                  setPromoFilters((current) => ({
                    ...current,
                    status: event.target.value as StatusFilter
                  }))
                }
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="inactive">Отключённые</MenuItem>
              </TextField>
              <Button variant="text" onClick={() => setPromoFilters(defaultPromoFilters)}>
                Сбросить
              </Button>
            </Stack>

            <DataGrid
              rows={promoQuery.data?.data ?? []}
              getRowId={(row) => row.promocode_id}
              columns={promoColumns}
              paginationMode="server"
              sortingMode="server"
              rowCount={promoQuery.data?.meta.total ?? 0}
              loading={promoQuery.isLoading}
              paginationModel={promoPagination}
              onPaginationModelChange={setPromoPagination}
              sortModel={promoSort}
              onSortModelChange={setPromoSort}
              pageSizeOptions={[5, 10, 20]}
              autoHeight
            />
          </Stack>
        )}

        {tab === 'promo-usages' && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Промокод"
                value={usageFilters.promoCode}
                onChange={(event) =>
                  setUsageFilters((current) => ({ ...current, promoCode: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Email"
                value={usageFilters.userEmail}
                onChange={(event) =>
                  setUsageFilters((current) => ({ ...current, userEmail: event.target.value }))
                }
                fullWidth
              />
              <TextField
                label="Имя"
                value={usageFilters.userName}
                onChange={(event) =>
                  setUsageFilters((current) => ({ ...current, userName: event.target.value }))
                }
                fullWidth
              />
              <Button variant="text" onClick={() => setUsageFilters(defaultUsageFilters)}>
                Сбросить
              </Button>
            </Stack>

            <DataGrid
              rows={usageQuery.data?.data ?? []}
              getRowId={(row) => row.usage_id}
              columns={usageColumns}
              paginationMode="server"
              sortingMode="server"
              rowCount={usageQuery.data?.meta.total ?? 0}
              loading={usageQuery.isLoading}
              paginationModel={usagePagination}
              onPaginationModelChange={setUsagePagination}
              sortModel={usageSort}
              onSortModelChange={setUsageSort}
              pageSizeOptions={[5, 10, 20]}
              autoHeight
            />
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

function toStatusParam(value: StatusFilter): 'active' | 'inactive' | undefined {
  return value === 'all' ? undefined : value;
}
