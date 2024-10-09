import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid, CircularProgress, Paper, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import VideoPlayer from '../components/VideoPlayer';
import { ChevronLeft, ChevronRight, Delete, PlayArrow } from '@mui/icons-material';

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://192.168.1.6:9000/",
  //endpoint: "http://192.168.43.179:9000/",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "UMmgKYXAQFriWVwVcWLP",
    secretAccessKey: "9l02BzE9nR5d9FrTqfHLW13gR6IU4n4V9fPDiPek",
  },
});

function FetchInterview() {
  const [rollNumber, setRollNumber] = useState('');
  const [interviewStatus, setInterviewStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedVideos, setFetchedVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [interviews, setInterviews] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteRollNumber, setDeleteRollNumber] = useState('');
  const [showVideos, setShowVideos] = useState(false);
  const [selectedRollNumber, setSelectedRollNumber] = useState('');

  useEffect(() => {
    fetchAllInterviews();
  }, []);

  const fetchAllInterviews = async () => {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "test1",
        Prefix: "interviews/",
        Delimiter: "/",
      });
      const listResponse = await s3Client.send(listCommand);
      if (listResponse.CommonPrefixes) {
        const interviewList = await Promise.all(
          listResponse.CommonPrefixes.map(async (prefix) => {
            const rollNumber = prefix.Prefix.split('/')[1];
            const dateTimeCommand = new ListObjectsV2Command({
              Bucket: "test1",
              Prefix: `interviews/${rollNumber}/`,
              MaxKeys: 1,
            });
            const dateTimeResponse = await s3Client.send(dateTimeCommand);
            const dateTime = dateTimeResponse.Contents?.[0]?.LastModified?.toLocaleString() || 'Unknown';
            return { rollNumber, dateTime };
          })
        );
        setInterviews(interviewList);
      }
    } catch (error) {
      console.error('Error fetching all interviews:', error);
    }
  };

  const fetchInterview = async (rollNumberToFetch) => {
    setIsLoading(true);
    setInterviewStatus(`Fetching interview for Roll Number: ${rollNumberToFetch}`);
    setFetchedVideos([]);
    setCurrentVideoIndex(0);
    const folderPrefix = `interviews/${rollNumberToFetch}/`;
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "test1",
        Prefix: folderPrefix,
      });
      const listResponse = await s3Client.send(listCommand);
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        throw new Error('No videos found');
      }
      const videoFiles = listResponse.Contents.filter(item => item.Key?.endsWith('_interview.webm'));
      const captionFiles = listResponse.Contents.filter(item => item.Key?.endsWith('_captions.vtt'));
      const videos = await Promise.all(videoFiles.map(async (videoFile) => {
        const videoKey = videoFile.Key;
        const videoCommand = new GetObjectCommand({
          Bucket: "test1",
          Key: videoKey,
        });
        const videoUrl = await getSignedUrl(s3Client, videoCommand, { expiresIn: 3600 });
        const captionKey = captionFiles.find(item => item.Key?.replace('_captions.vtt', '') === videoKey.replace('_interview.webm', ''))?.Key;
        let captionsContent = '';
        if (captionKey) {
          const captionsCommand = new GetObjectCommand({
            Bucket: "test1",
            Key: captionKey,
          });
          const captionsUrl = await getSignedUrl(s3Client, captionsCommand, { expiresIn: 3600 });
          const captionsResponse = await fetch(captionsUrl);
          if (captionsResponse.ok) {
            captionsContent = await captionsResponse.text();
          }
        }
        return { url: videoUrl, captions: captionsContent };
      }));
      setFetchedVideos(videos);
      setInterviewStatus(`${videos.length} interview video(s) fetched successfully for Roll Number: ${rollNumberToFetch}`);
    } catch (error) {
      console.error('Error fetching interview:', error);
      setFetchedVideos([]);
      setInterviewStatus(`No recorded interview found for Roll Number: ${rollNumberToFetch}`);
    } finally {
      setIsLoading(false);
    }
    setShowVideos(true);
  };

  const handleDeleteInterview = async () => {
    setDeleteConfirmOpen(false);
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "test1",
        Prefix: `interviews/${deleteRollNumber}/`,
      });
      const listResponse = await s3Client.send(listCommand);
      if (listResponse.Contents) {
        await Promise.all(listResponse.Contents.map(async (item) => {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: "test1",
            Key: item.Key,
          });
          await s3Client.send(deleteCommand);
        }));
      }
      setInterviewStatus(`Interview for Roll Number ${deleteRollNumber} deleted successfully`);
      fetchAllInterviews();
    } catch (error) {
      console.error('Error deleting interview:', error);
      setInterviewStatus(`Error deleting interview for Roll Number ${deleteRollNumber}`);
    }
  };

  const handlePrevVideo = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleNextVideo = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex < fetchedVideos.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleGoBack = () => {
    setShowVideos(false);
    setFetchedVideos([]);
    setCurrentVideoIndex(0);
    setInterviewStatus('');
    setSelectedRollNumber('');
    setRollNumber('');
    fetchAllInterviews();
  };

  const handlePlayVideo = (rollNumberToPlay) => {
    setSelectedRollNumber(rollNumberToPlay);
    fetchInterview(rollNumberToPlay);
  };

  const sortedInterviews = [...interviews].sort((a, b) => {
    return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <Box sx={{ p: 3, maxWidth: '1000px', margin: '0 auto' }}>
      {!showVideos ? (
        <>
          <Paper elevation={3} sx={{ p: 4, backgroundColor: '#f5f5f5', mb: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ color: '#333', fontWeight: 'bold', textAlign: 'center' }}>
              Fetch Interview
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Candidate Roll Number"
                  variant="outlined"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  sx={{ backgroundColor: 'white' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => handlePlayVideo(rollNumber)}
                  disabled={!rollNumber || isLoading}
                  sx={{ height: '56px' }}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Retrieve Interview'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
          <Paper elevation={3} sx={{ p: 4, backgroundColor: '#f5f5f5' }}>
            <Typography variant="h5" gutterBottom sx={{ color: '#333', fontWeight: 'bold', textAlign: 'center' }}>
              Available Interviews
            </Typography>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Roll Number</TableCell>
                    <TableCell>Date and Time</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedInterviews.map((interview) => (
                    <TableRow key={interview.rollNumber}>
                      <TableCell>{interview.rollNumber}</TableCell>
                      <TableCell>{interview.dateTime}</TableCell>
                      <TableCell align="center">
                        <IconButton onClick={() => handlePlayVideo(interview.rollNumber)} color="primary">
                          <PlayArrow />
                        </IconButton>
                        <IconButton
                          onClick={() => {
                            setDeleteRollNumber(interview.rollNumber);
                            setDeleteConfirmOpen(true);
                          }}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : (
        <Paper elevation={3} sx={{ p: 4, backgroundColor: '#f5f5f5' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button variant="outlined" onClick={handleGoBack}>
              Go Back
            </Button>
            <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 'bold', textAlign: 'center', flexGrow: 1, mr: 10 }}>
              Interview videos for Roll number: {selectedRollNumber}
            </Typography>
          </Box>
          {fetchedVideos.length > 0 ? (
            <Box>
              <Box sx={{ mt: 2, maxWidth: '600px', margin: '0 auto' }}>
                <VideoPlayer
                  src={fetchedVideos[currentVideoIndex].url}
                  captionsContent={fetchedVideos[currentVideoIndex].captions}
                />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
                  <IconButton onClick={handlePrevVideo} disabled={currentVideoIndex === 0}>
                    <ChevronLeft />
                  </IconButton>
                  <Typography variant="subtitle1" sx={{ mx: 2 }}>
                    Video {currentVideoIndex + 1} of {fetchedVideos.length}
                  </Typography>
                  <IconButton onClick={handleNextVideo} disabled={currentVideoIndex === fetchedVideos.length - 1}>
                    <ChevronRight />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ textAlign: 'center' }} color="error">
              {interviewStatus}
            </Typography>
          )}
        </Paper>
      )}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the interview for Roll Number {deleteRollNumber}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteInterview} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FetchInterview;