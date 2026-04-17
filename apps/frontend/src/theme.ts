import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1d6b6f'
    },
    secondary: {
      main: '#f08c2e'
    },
    background: {
      default: '#f4f1eb',
      paper: '#ffffff'
    },
    text: {
      primary: '#1e1b16',
      secondary: '#4b4540'
    }
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h2: {
      fontWeight: 600,
      letterSpacing: '-0.01em'
    },
    h3: {
      fontWeight: 600
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid #e6dfd6',
          boxShadow: '0 8px 24px rgba(27, 22, 16, 0.08)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
          backgroundColor: '#fff'
        },
        columnHeaders: {
          backgroundColor: '#f6f2ec',
          borderBottom: '1px solid #ebe3d7'
        },
        row: {
          backgroundColor: '#fff'
        }
      }
    }
  }
});
