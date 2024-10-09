//works
//working for split
import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid, IconButton, Paper, ThemeProvider, createTheme, Card, CardActions, CardContent } from '@mui/material';
import { RecordVoiceOver } from '@mui/icons-material';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import VideoRecording from '../components/VideoRecording';

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://192.168.1.5:9000/",
   //endpoint: "http://192.168.43.179:9000/",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "3IwS3yhDtXr7rDw3wsEi",
    secretAccessKey: "puKrxzhT15F3V1n43qkGr8umubhSwsDT9xfCUom9",
  },
});

const questions = [
  "Tell me about yourself.",
  "What are your strengths?",
  "What are your weaknesses?",
  "Why do you want to work here?",
  "Where do you see yourself in 5 years?"
];

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#f50057' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
});

export default function StartInterview() {
  const [rollNumber, setRollNumber] = useState('');
  const [interviewStatus, setInterviewStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCCOn, setIsCCOn] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(30);
  const [showWarning, setShowWarning] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);

  const [videoStream, setVideoStream] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const captionsBufferRef = useRef([]);
  const lastCaptionTimeRef = useRef(0);
  const interimTranscriptRef = useRef('');
  const recordingStartTimeRef = useRef(0);
  const ttsRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
      ttsRef.current = new window.SpeechSynthesisUtterance();
    }
  }, []);

  useEffect(() => {
    let timer;
    if (isRecording && remainingTime > 0) {
      timer = setInterval(() => {
        setRemainingTime(prevTime => {
          if (prevTime === 11) { setShowWarning(true); }
          if (prevTime === 1) {
            if (currentQuestionIndex === questions.length - 1) {
              endInterview();
            } else {
              handleNextQuestion();
            }
            return 30;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording, remainingTime, currentQuestionIndex]);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        if (!isMicOn) return;
        const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          const newCaption = { start: lastCaptionTimeRef.current, end: currentTime, text: finalTranscript.trim() };
          captionsBufferRef.current.push(newCaption);
          lastCaptionTimeRef.current = currentTime;
          interimTranscriptRef.current = '';
        } else {
          interimTranscriptRef.current = interimTranscript;
        }
        setTranscript(prevTranscript => {
          const completedTranscript = captionsBufferRef.current.map(c => c.text).join(' ');
          return completedTranscript + (interimTranscript ? ' ' + interimTranscript : '');
        });
      };
      recognitionRef.current.onend = () => {
        if (interimTranscriptRef.current) {
          const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
          captionsBufferRef.current.push({ start: lastCaptionTimeRef.current, end: currentTime, text: interimTranscriptRef.current.trim() });
          interimTranscriptRef.current = '';
          setTranscript(captionsBufferRef.current.map(c => c.text).join(' '));
        }
      };
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isMicOn]);

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    if (isTTSPlaying && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsTTSPlaying(false);
    }
  };

  const playTTS = (text) => {
    if (isTTSEnabled && window.speechSynthesis && ttsRef.current) {
      window.speechSynthesis.cancel();
      ttsRef.current.text = text;
      window.speechSynthesis.speak(ttsRef.current);
      setIsTTSPlaying(true);
    }
  };

  useEffect(() => {
    if (ttsRef.current) {
      ttsRef.current.onend = () => setIsTTSPlaying(false);
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && isTTSEnabled && ttsRef.current) {
      playTTS(questions[currentQuestionIndex]);
    }
  }, [currentQuestionIndex, isRecording, isTTSEnabled]);

  const startInterview = async () => {
    setInterviewStatus('Starting interview...');
    setCurrentQuestionIndex(0);
    setRemainingTime(30);
    setShowWarning(false);
    setInterviewStarted(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setVideoStream(stream);
      startRecording();
    } catch (error) {
      console.error('Error accessing camera:', error);
      setInterviewStatus('Error accessing camera. Please check your permissions.');
      setInterviewStarted(false);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      console.error('No stream available for recording');
      return;
    }
    mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    captionsBufferRef.current = [];
    lastCaptionTimeRef.current = 0;
    recordingStartTimeRef.current = Date.now();
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      uploadToS3(blob);
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setInterviewStatus(`Recording Question ${currentQuestionIndex + 1}...`);
    if (recognitionRef.current && isCCOn) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          uploadToS3(blob).then(() => {
            resolve();
          });
        };
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (error) {
            console.error('Error stopping speech recognition:', error);
          }
        }
      } else {
        resolve();
      }
    });
  };

  const handleNextQuestion = async () => {
    await stopRecording();
    chunksRef.current = [];
    captionsBufferRef.current = [];
    setTranscript('');
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        setInterviewStatus(`Recording Question ${newIndex + 1}...`);
        return newIndex;
      });
      setRemainingTime(30);
      setShowWarning(false);
      startRecording();
    } else {
      endInterview();
    }
  };

  const endInterview = () => {
    stopRecording().then(() => {
      setInterviewStatus('Interview completed.');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setVideoStream(null);
      setIsRecording(false);
      setInterviewStarted(false);
      resetInterview();
    });
  };

  const resetInterview = () => {
    setRollNumber('');
    setCurrentQuestionIndex(0);
    setRemainingTime(30);
    setShowWarning(false);
    setTranscript('');
    chunksRef.current = [];
    captionsBufferRef.current = [];
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
      if (!audioTrack.enabled) {
        setIsCCOn(false);
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }
    }
  };

  const toggleCC = () => {
    if (!isMicOn) return;
    setIsCCOn(!isCCOn);
    if (!isCCOn) {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setTranscript('');
    }
  };

  const createVTTContent = (captions) => {
    let vttContent = 'WEBVTT\n\n';
    captions.forEach((caption, index) => {
      vttContent += `${index + 1}\n`;
      vttContent += `${formatVTTTime(caption.start)} --> ${formatVTTTime(caption.end)}\n`;
      vttContent += `${caption.text}\n\n`;
    });
    return vttContent;
  };

  const formatVTTTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };

  const uploadToS3 = async (blob) => {
    const questionLetter = String.fromCharCode(65 + currentQuestionIndex);
    const videoKey = `interviews/${rollNumber}/${rollNumber}${questionLetter}_interview.webm`;
    const captionsKey = `interviews/${rollNumber}/${rollNumber}${questionLetter}_captions.vtt`;
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: "test1",
        Key: videoKey,
        Body: blob,
        ContentType: 'video/webm',
      }));
      const vttContent = createVTTContent(captionsBufferRef.current);
      await s3Client.send(new PutObjectCommand({
        Bucket: "test1",
        Key: captionsKey,
        Body: vttContent,
        ContentType: 'text/vtt',
      }));
      setInterviewStatus(`Question ${currentQuestionIndex + 1} uploaded successfully.`);
    } catch (error) {
      console.error('Error uploading interview or captions:', error);
      setInterviewStatus('Error saving interview. Please try again.');
    }
  };

  const handleLowLightEndInterview = () => {
    endInterview();
    setInterviewStatus('Interview ended due to prolonged low light conditions.');
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ p: 4, maxWidth: '1200px', margin: '0 auto' }}>
        <Paper elevation={3} sx={{ p: 4, backgroundColor: '#f8f8f8', borderRadius: '12px' }}>
          <Typography variant="h4" gutterBottom sx={{ color: '#333', fontWeight: 'bold', textAlign: 'center', mb: 4 }}>
            Start Interview
          </Typography>
          <Grid container spacing={3} alignItems="center" sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Candidate Roll Number"
                variant="outlined"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                disabled={isRecording}
                sx={{
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="contained"
                onClick={isRecording ? endInterview : startInterview}
                disabled={!rollNumber || (isRecording && currentQuestionIndex !== questions.length - 1)}
                sx={{
                  height: '56px',
                  backgroundColor: isRecording ? theme.palette.secondary.main : theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: isRecording ? theme.palette.secondary.dark : theme.palette.primary.dark,
                  },
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                {isRecording ? 'End Interview' : 'Start Interview'}
              </Button>
            </Grid>
          </Grid>
          {interviewStatus && (
            <Typography
              sx={{
                mt: 2,
                mb: 3,
                textAlign: 'center',
                fontWeight: 'medium',
                fontSize: '1.1rem',
                color: interviewStatus.includes('Error') ? theme.palette.error.main : theme.palette.success.main,
                padding: '10px',
                backgroundColor: interviewStatus.includes('Error') ? '#ffebee' : '#e8f5e9',
                borderRadius: '8px',
              }}
            >
              {interviewStatus}
            </Typography>
          )}
          {interviewStarted && (
            <Grid container spacing={4}>
              <Grid item xs={12} md={8}>
                <VideoRecording
                  isRecording={isRecording}
                  isCameraOn={isCameraOn}
                  setIsCameraOn={setIsCameraOn}
                  isMicOn={isMicOn}
                  setIsMicOn={setIsMicOn}
                  isCCOn={isCCOn}
                  setIsCCOn={setIsCCOn}
                  remainingTime={remainingTime}
                  showWarning={showWarning}
                  transcript={transcript}
                  onToggleCamera={toggleCamera}
                  onToggleMic={toggleMic}
                  onToggleCC={toggleCC}
                  theme={theme}
                  videoStream={videoStream}
                  onEndInterview={handleLowLightEndInterview}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                {isRecording ? (
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                          Question {currentQuestionIndex + 1} of {questions.length}
                        </Typography>
                        <IconButton
                          onClick={toggleTTS}
                          sx={{ color: isTTSEnabled ? (isTTSPlaying ? theme.palette.primary.main : 'inherit') : 'grey' }}
                        >
                          <RecordVoiceOver />
                        </IconButton>
                      </Box>
                      <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic', fontWeight: 'medium' }}>
                        "{questions[currentQuestionIndex]}"
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'center', padding: '16px' }}>
                      <Button
                        variant="contained"
                        onClick={handleNextQuestion}
                        disabled={currentQuestionIndex === questions.length - 1}
                        sx={{
                          backgroundColor: theme.palette.primary.main,
                          '&:hover': {
                            backgroundColor: theme.palette.primary.dark,
                          },
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          padding: '10px 30px',
                        }}
                      >
                        Next Question
                      </Button>
                    </CardActions>
                  </Card>
                ) : (
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: theme.palette.text.secondary, textAlign: 'center' }}>
                        {interviewStatus}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
