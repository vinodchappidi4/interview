import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

const VirtualBackground = ({ videoStream, backgroundImage, isEnabled }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [net, setNet] = useState(null);

  useEffect(() => {
    if (!videoStream || !isEnabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.error("Video or canvas element not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    video.srcObject = videoStream;
    
    const playVideo = async () => {
      try {
        await video.play();
        console.log("Video started playing");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      } catch (error) {
        console.error("Error playing video:", error);
      }
    };

    playVideo();

    const loadBodyPix = async () => {
      try {
        const loadedNet = await bodyPix.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        });
        setNet(loadedNet);
        console.log("BodyPix model loaded successfully");
      } catch (error) {
        console.error("Error loading BodyPix model:", error);
      }
    };

    loadBodyPix();

    return () => {
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [videoStream, isEnabled]);

  useEffect(() => {
    if (!net || !isEnabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.error("Video or canvas element not found");
      return;
    }

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const segmentPerson = async () => {
      if (video.readyState < 2) {
        animationFrameId = requestAnimationFrame(segmentPerson);
        return;
      }

      try {
        const segmentation = await net.segmentPerson(video);
        const backgroundImg = new Image();
        backgroundImg.src = backgroundImage;

        backgroundImg.onload = () => {
          ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixel = imageData.data;
          for (let i = 0; i < pixel.length; i += 4) {
            if (segmentation.data[i / 4] === 1) {
              const [r, g, b, a] = ctx.getImageData(i % canvas.width, Math.floor(i / 4 / canvas.width), 1, 1).data;
              pixel[i] = r;
              pixel[i + 1] = g;
              pixel[i + 2] = b;
              pixel[i + 3] = a;
            }
          }
          ctx.putImageData(imageData, 0, 0);
          animationFrameId = requestAnimationFrame(segmentPerson);
        };

        backgroundImg.onerror = () => {
          console.error("Failed to load background image");
        };
      } catch (error) {
        console.error("Error in segmentPerson:", error);
        animationFrameId = requestAnimationFrame(segmentPerson);
      }
    };

    segmentPerson();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [net, backgroundImage, isEnabled]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
        hidden
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};

export default VirtualBackground;