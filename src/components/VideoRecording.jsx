import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, Fade } from '@mui/material';
import { Videocam, VideocamOff, Mic, MicOff, ClosedCaption, ClosedCaptionDisabled } from '@mui/icons-material';
import LowLightAlert from './LowLightAlert';
import CountdownAlert from './CountdownAlert';

const VideoRecording = ({ isRecording, isCameraOn, setIsCameraOn, isMicOn, setIsMicOn, isCCOn, setIsCCOn, remainingTime, showWarning, transcript, onToggleCamera, onToggleMic, onToggleCC, theme, videoStream, onEndInterview }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showLowLightAlert, setShowLowLightAlert] = useState(false);
  const [showCountdownAlert, setShowCountdownAlert] = useState(false);
  const lowLightTimeoutRef = useRef(null);
  const countdownTimeoutRef = useRef(null);

  useEffect(() => {
    if (videoStream && videoRef.current) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(error => {
        console.error("Error playing video:", error);
      });
    }
  }, [videoStream]);

  useEffect(() => {
    if (videoRef.current) {
      if (isCameraOn) {
        videoRef.current.play().catch(error => {
          console.error("Error playing video after camera on:", error);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isCameraOn]);

  useEffect(() => {
    if (isRecording && isCameraOn) {
      const checkLighting = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightness += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        }
        brightness /= (data.length / 4);

        if (brightness < 0.3) { // Adjust this threshold as needed
          setShowLowLightAlert(true);
          if (lowLightTimeoutRef.current === null) {
            lowLightTimeoutRef.current = setTimeout(() => {
              setShowLowLightAlert(false);
              setShowCountdownAlert(true);
            }, 10000);
          }
        } else {
          setShowLowLightAlert(false);
          setShowCountdownAlert(false);
          if (lowLightTimeoutRef.current !== null) {
            clearTimeout(lowLightTimeoutRef.current);
            lowLightTimeoutRef.current = null;
          }
          if (countdownTimeoutRef.current !== null) {
            clearTimeout(countdownTimeoutRef.current);
            countdownTimeoutRef.current = null;
          }
        }
      };

      const intervalId = setInterval(checkLighting, 1000);
      return () => {
        clearInterval(intervalId);
        if (lowLightTimeoutRef.current !== null) {
          clearTimeout(lowLightTimeoutRef.current);
          lowLightTimeoutRef.current = null;
        }
        if (countdownTimeoutRef.current !== null) {
          clearTimeout(countdownTimeoutRef.current);
          countdownTimeoutRef.current = null;
        }
      };
    }
  }, [isRecording, isCameraOn]);

  const handleCloseLowLightAlert = () => {
    setShowLowLightAlert(false);
  };

  const handleCountdownComplete = () => {
    setShowCountdownAlert(false);
    onEndInterview();
  };

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', boxShadow: 3, aspectRatio: '16 / 9' }}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
        <video ref={videoRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: isCameraOn ? 'block' : 'none' }} autoPlay playsInline muted={!isMicOn} />
        <canvas ref={canvasRef} style={{ display: 'none' }} width="320" height="240" />
        {isRecording && (
          <Fade in={true}>
            <Box sx={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: '20px', padding: '8px 16px' }}>
              <Box sx={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'red', marginRight: '10px' }} />
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>REC</Typography>
            </Box>
          </Fade>
        )}
        <Box sx={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: '20px', padding: '8px 16px' }}>
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
            {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
          </Typography>
        </Box>
        {showWarning && (
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255, 0, 0, 0.8)', borderRadius: '8px', padding: '12px 24px' }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              10 seconds remaining
            </Typography>
          </Box>
        )}
        <Box sx={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, padding: '10px 20px', backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: '30px' }}>
          <IconButton onClick={onToggleCamera} sx={{ color: isCameraOn ? theme.palette.primary.main : 'white' }}>
            {isCameraOn ? <Videocam /> : <VideocamOff />}
          </IconButton>
          <IconButton onClick={onToggleMic} sx={{ color: isMicOn ? theme.palette.primary.main : 'white' }}>
            {isMicOn ? <Mic /> : <MicOff />}
          </IconButton>
          <IconButton onClick={onToggleCC} sx={{ color: isCCOn ? theme.palette.primary.main : 'white' }}>
            {isCCOn ? <ClosedCaption /> : <ClosedCaptionDisabled />}
          </IconButton>
        </Box>
        {isCCOn && (
          <Box sx={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxHeight: '120px', overflowY: 'auto', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '16px', borderRadius: '12px', fontFamily: theme.typography.fontFamily, fontSize: '18px', lineHeight: 1.5 }}>
            {transcript}
          </Box>
        )}
      </Box>
      <LowLightAlert open={showLowLightAlert} onClose={handleCloseLowLightAlert} />
      <CountdownAlert 
        open={showCountdownAlert} 
        onClose={() => setShowCountdownAlert(false)} 
        duration={10} 
        onComplete={handleCountdownComplete}
      />
    </Box>
  );
};

export default VideoRecording;