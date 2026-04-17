import { useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { ToastContext, type ToastContextValue } from './toast-context';

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<ToastSeverity>('info');

  const openToast = (nextSeverity: ToastSeverity, text: string) => {
    setSeverity(nextSeverity);
    setMessage(text);
    setOpen(true);
  };

  const value: ToastContextValue = {
    showSuccess: (text) => openToast('success', text),
    showError: (text) => openToast('error', text),
    showInfo: (text) => openToast('info', text)
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={severity} variant="filled" onClose={() => setOpen(false)}>
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
