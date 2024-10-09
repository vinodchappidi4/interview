import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, LinearProgress } from '@mui/material';

const CountdownAlert = ({ open, onClose, duration, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (open && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);

      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      onComplete();
    }
  }, [open, timeLeft, onComplete]);

  useEffect(() => {
    if (open) {
      setTimeLeft(duration);
    }
  }, [open, duration]);

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      open={open}
    >
      <Alert severity="error" sx={{ width: '100%' }}>
        Interview ends in {timeLeft} seconds. Move to a well-lit area!
        <LinearProgress 
          variant="determinate" 
          value={(duration - timeLeft) / duration * 100} 
          sx={{ mt: 1 }}
        />
      </Alert>
    </Snackbar>
  );
};

export default CountdownAlert;