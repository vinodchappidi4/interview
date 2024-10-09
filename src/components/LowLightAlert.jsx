import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const LowLightAlert = ({ open, onClose }) => {
  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      open={open}
      autoHideDuration={10000}
      onClose={onClose}
    >
      <Alert onClose={onClose} severity="warning" sx={{ width: '100%' }}>
        Low light detected! Please adjust your lighting or camera position.
      </Alert>
    </Snackbar>
  );
};

export default LowLightAlert;