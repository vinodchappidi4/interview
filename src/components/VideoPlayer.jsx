import React, { useState, useRef, useEffect } from 'react';
import { Box, Slider, IconButton, Fade, Menu, MenuItem, Typography } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff, ClosedCaption, ClosedCaptionDisabled, FastForward, FastRewind, Fullscreen, FullscreenExit, SettingsOutlined } from '@mui/icons-material';

const VideoPlayer = ({ src, isRecording = false, recordingDuration = 0, captionsContent }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captions] = useState([]);
  const captionsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !captionsContent) return;

    // Disable all existing tracks
    Array.from(video.textTracks).forEach(track => {
      track.mode = 'disabled';
    });

    // Create a new track
    const track = video.addTextTrack("captions", "English", "en");
    track.mode = captionsEnabled ? "showing" : "hidden";

    // Parse and add cues
    const lines = captionsContent.split('\n');
    let currentCue = null;
    lines.forEach((line) => {
      if (line.includes('-->')) {
        if (currentCue) {
          track.addCue(currentCue);
        }
        const [start, end] = line.split('-->').map(timeString => {
          const [hours, minutes, seconds] = timeString.trim().split(':');
          return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        });
        currentCue = new VTTCue(start, end, '');
      } else if (currentCue) {
        currentCue.text += line + '\n';
      }
    });
    if (currentCue) {
      track.addCue(currentCue);
    }

    // Apply styles to captions
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ::cue {
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        font-family: Arial, sans-serif;
        font-size: 18px;
        line-height: 1.5;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: pre-line;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      // Clean up: disable the track and remove styles when component unmounts or src changes
      if (track) {
        track.mode = 'disabled';
      }
      document.head.removeChild(styleElement);
    };
  }, [captionsContent, src, captionsEnabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !captionsEnabled) return;

    const updateCaptions = () => {
      const currentTime = video.currentTime;
      const currentCaption = captions.find(
        caption => currentTime >= caption.start && currentTime < caption.end
      );
      if (captionsRef.current) {
        captionsRef.current.textContent = currentCaption ? currentCaption.text : '';
      }
    };

    video.addEventListener('timeupdate', updateCaptions);
    return () => video.removeEventListener('timeupdate', updateCaptions);
  }, [captions, captionsEnabled]);

  useEffect(() => {
    if (isRecording) {
      setDuration(recordingDuration);
    }
  }, [isRecording, recordingDuration]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Set duration immediately before playing
        if (isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
          setDuration(videoRef.current.duration);
        } else {
          // If duration is not available, estimate it
          estimateDuration();
        }
        videoRef.current.play().catch(error => {
          console.error("Error playing video:", error);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const estimateDuration = () => {
    const video = videoRef.current;
    if (video) {
      // Try to seek near the end of the video to force duration calculation
      video.currentTime = 1000000; // A large number to seek to the end
      setTimeout(() => {
        if (isFinite(video.duration) && video.duration > 0) {
          setDuration(video.duration);
        } else {
          setDuration(0); // Set to 0 if still not available
        }
        video.currentTime = 0; // Reset to beginning
      }, 200); // Wait a bit for the seek to complete
    }
  };

  const handleVolumeChange = (event, newValue) => {
    const newVolume = newValue;
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (event, newValue) => {
    const newTime = newValue;
    if (isFinite(newTime) && videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleFastForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  };

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time) => {
    if (!isFinite(time) || time === 0) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const toggleCaptions = () => {
    setCaptionsEnabled(!captionsEnabled);
    if (videoRef.current && videoRef.current.textTracks.length > 0) {
      videoRef.current.textTracks[0].mode = captionsEnabled ? "hidden" : "showing";
    }
  };

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setAnchorEl(null);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!anchorEl) {
        setShowControls(false);
      }
    }, 3000);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        borderRadius: '8px'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        style={{ width: '100%', height: 'auto' }}
        onClick={togglePlay}
      >
        <track kind="captions" src="" srcLang="en" label="English" />
      </video>
      <Fade in={showControls}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            padding: '20px',
            transition: 'opacity 0.3s',
          }}
        >
          <Slider
            value={currentTime}
            min={0}
            max={duration || 100}
            onChange={handleSeek}
            sx={{
              color: 'primary.main',
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0px 0px 0px 8px rgb(25 118 210 / 16%)'
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={handleRewind} sx={{ color: 'white' }}>
                <FastRewind />
              </IconButton>
              <IconButton onClick={togglePlay} sx={{ color: 'white' }}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <IconButton onClick={handleFastForward} sx={{ color: 'white' }}>
                <FastForward />
              </IconButton>
              <IconButton onClick={toggleMute} sx={{ color: 'white' }}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              <Slider
                value={volume}
                min={0}
                max={1}
                step={0.1}
                onChange={handleVolumeChange}
                sx={{
                  width: 100,
                  ml: 1,
                  color: 'white',
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                  },
                }}
              />
              <Typography sx={{ ml: 2, color: 'white' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Typography>
            </Box>
            <Box>
              <IconButton onClick={toggleCaptions} sx={{ color: captionsEnabled ? 'white' : 'white' }}>
                {captionsEnabled ? <ClosedCaption /> : <ClosedCaptionDisabled />}
              </IconButton>
              <IconButton
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{ color: 'white' }}
              >
                <SettingsOutlined />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => handlePlaybackRateChange(0.5)}>0.5x</MenuItem>
                <MenuItem onClick={() => handlePlaybackRateChange(1)}>1x</MenuItem>
                <MenuItem onClick={() => handlePlaybackRateChange(1.5)}>1.5x</MenuItem>
                <MenuItem onClick={() => handlePlaybackRateChange(2)}>2x</MenuItem>
              </Menu>
              <IconButton onClick={toggleFullscreen} sx={{ color: 'white' }}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default VideoPlayer;