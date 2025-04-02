import { useState, useRef, useEffect } from 'react';
import { Joint, MarkerIds, SkeletonModel, Frame } from '../types';
import {
  applyLengthConstraints,
  applyTemporalSmoothing,
  fillMissingMarkers
} from '../utils/skeletonUtils';

interface SkeletonVisualizationViewProps {
  skeletonData: any;
}

const SkeletonVisualizationView = ({ skeletonData }: SkeletonVisualizationViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showMarkerLabels, setShowMarkerLabels] = useState<boolean>(false);
  const [showJointLengths, setShowJointLengths] = useState<boolean>(false);
  const [showConstraints, setShowConstraints] = useState<boolean>(true);
  const [smoothingLevel, setSmoothingLevel] = useState<number>(0);
  const [smoothedFrames, setSmoothedFrames] = useState<Frame[]>([]);
  const [constrainedFrames, setConstrainedFrames] = useState<Frame[]>([]);
  const [displayMode, setDisplayMode] = useState<'original' | 'smoothed' | 'constrained'>('original');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  // Initialize visualization
  useEffect(() => {
    if (skeletonData && skeletonData.rawData && skeletonData.rawData.frames) {
      // Apply smoothing if needed
      if (smoothingLevel > 0) {
        const smoothed = applyTemporalSmoothing(
          skeletonData.rawData.frames,
          smoothingLevel * 2 + 1
        );
        setSmoothedFrames(smoothed);
      }

      // Apply constraints if needed
      if (showConstraints && skeletonData.skeletonModel && skeletonData.skeletonModel.joints) {
        const constrained = skeletonData.rawData.frames.map((frame: Frame) =>
          applyLengthConstraints(frame, skeletonData.skeletonModel.joints)
        );
        setConstrainedFrames(constrained);
      }

      // Reset playback
      setCurrentFrame(0);
      setIsPlaying(false);

      // Draw first frame
      drawFrame(0);
    }
  }, [skeletonData]);

  // Handle changes in display options
  useEffect(() => {
    drawFrame(currentFrame);
  }, [
    showMarkerLabels,
    showJointLengths,
    showConstraints,
    displayMode,
    zoomLevel,
    panOffset
  ]);

  // Handle smoothing level changes
  useEffect(() => {
    if (skeletonData && skeletonData.rawData && skeletonData.rawData.frames) {
      if (smoothingLevel > 0) {
        const smoothed = applyTemporalSmoothing(
          skeletonData.rawData.frames,
          smoothingLevel * 2 + 1
        );
        setSmoothedFrames(smoothed);
      }
      drawFrame(currentFrame);
    }
  }, [smoothingLevel]);

  // Handle constraint changes
  useEffect(() => {
    if (skeletonData && skeletonData.rawData && skeletonData.rawData.frames &&
        skeletonData.skeletonModel && skeletonData.skeletonModel.joints) {
      if (showConstraints) {
        const constrained = skeletonData.rawData.frames.map((frame: Frame) =>
          applyLengthConstraints(frame, skeletonData.skeletonModel.joints)
        );
        setConstrainedFrames(constrained);
      }
      drawFrame(currentFrame);
    }
  }, [showConstraints]);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = (timestamp: number) => {
        if (!lastFrameTimeRef.current) {
          lastFrameTimeRef.current = timestamp;
        }

        const elapsed = timestamp - lastFrameTimeRef.current;
        const framesPerSecond = 30; // Assuming 30 fps
        const frameDuration = 1000 / framesPerSecond;

        if (elapsed > (frameDuration / playbackSpeed)) {
          const frames = getFramesArray();

          if (frames.length > 0) {
            setCurrentFrame(prev => {
              const next = prev + 1;
              return next >= frames.length ? 0 : next;
            });

            lastFrameTimeRef.current = timestamp;
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isPlaying, playbackSpeed, displayMode]);

  // Update canvas when current frame changes
  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame]);

  // Helper to get the active frames array based on display mode
  const getFramesArray = (): Frame[] => {
    if (!skeletonData || !skeletonData.rawData || !skeletonData.rawData.frames) {
      return [];
    }

    switch (displayMode) {
      case 'smoothed':
        return smoothingLevel > 0 ? smoothedFrames : skeletonData.rawData.frames;
      case 'constrained':
        return showConstraints ? constrainedFrames : skeletonData.rawData.frames;
      default:
        return skeletonData.rawData.frames;
    }
  };

  // Draw the current frame on the canvas
  const drawFrame = (frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx || !skeletonData) {
      return;
    }

    const frames = getFramesArray();

    if (!frames || frames.length === 0 || frameIndex >= frames.length) {
      return;
    }

    const frame = frames[frameIndex];

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up view transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Draw background grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw skeleton joints and connections
    if (skeletonData.skeletonModel && skeletonData.skeletonModel.joints) {
      drawConnections(ctx, frame, skeletonData.skeletonModel.joints);
    }

    // Draw markers
    drawMarkers(ctx, frame);

    // Restore canvas state
    ctx.restore();
  };

  // Draw a grid on the canvas
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 50;

    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;

    // Adjust for panning
    const offsetX = panOffset.x % (gridSize * zoomLevel);
    const offsetY = panOffset.y % (gridSize * zoomLevel);

    // Draw vertical lines
    for (let x = offsetX; x < width; x += gridSize * zoomLevel) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = offsetY; y < height; y += gridSize * zoomLevel) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Draw markers (points) on the canvas
  const drawMarkers = (ctx: CanvasRenderingContext2D, frame: Frame) => {
    if (!frame.markers) return;

    Object.entries(frame.markers).forEach(([markerId, marker]) => {
      if (marker.isVisible) {
        // Draw marker circle
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = getMarkerColor(markerId);
        ctx.fill();

        // Draw marker label if enabled
        if (showMarkerLabels) {
          ctx.fillStyle = 'black';
          ctx.font = '10px Arial';
          ctx.fillText(markerId, marker.x + 8, marker.y - 8);
        }
      }
    });
  };

  // Draw connections between markers
  const drawConnections = (ctx: CanvasRenderingContext2D, frame: Frame, joints: Joint[]) => {
    joints.forEach(joint => {
      const startMarker = frame.markers[joint.startMarkerId];
      const endMarker = frame.markers[joint.endMarkerId];

      if (startMarker && endMarker && startMarker.isVisible && endMarker.isVisible) {
        // Draw line connecting markers
        ctx.beginPath();
        ctx.moveTo(startMarker.x, startMarker.y);
        ctx.lineTo(endMarker.x, endMarker.y);
        ctx.strokeStyle = getJointColor(joint);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw joint length if enabled
        if (showJointLengths) {
          const midX = (startMarker.x + endMarker.x) / 2;
          const midY = (startMarker.y + endMarker.y) / 2;
          const distance = Math.sqrt(
            Math.pow(endMarker.x - startMarker.x, 2) +
            Math.pow(endMarker.y - startMarker.y, 2)
          );

          ctx.fillStyle = 'black';
          ctx.font = '10px Arial';
          ctx.fillText(distance.toFixed(1), midX, midY - 5);
        }
      }
    });
  };

  // Get color for a marker based on its ID
  const getMarkerColor = (markerId: string): string => {
    if (markerId.startsWith('R')) {
      return '#ff6666'; // Right side - red
    } else if (markerId.startsWith('L')) {
      return '#6666ff'; // Left side - blue
    } else {
      return '#66cc66'; // Center - green
    }
  };

  // Get color for a joint based on its properties
  const getJointColor = (joint: Joint): string => {
    if (joint.name.includes('Right')) {
      return '#ff3333'; // Right side - red
    } else if (joint.name.includes('Left')) {
      return '#3333ff'; // Left side - blue
    } else {
      return '#33cc33'; // Center - green
    }
  };

  // Handle playback controls
  const togglePlayback = () => {
    setIsPlaying(prev => !prev);
    lastFrameTimeRef.current = 0;
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(event.target.value);
    setCurrentFrame(frame);
  };

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(event.target.value);
    setPlaybackSpeed(speed);
  };

  const handleSmoothingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const level = parseInt(event.target.value);
    setSmoothingLevel(level);
  };

  // Handle zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Handle panning
  const handlePan = (dx: number, dy: number) => {
    setPanOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
  };

  // Handle canvas mouse interaction for panning
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;

      handlePan(dx, dy);

      setDragStart({
        x: event.clientX,
        y: event.clientY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Return early if no data is available
  if (!skeletonData || !skeletonData.rawData || !skeletonData.rawData.frames) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Skeleton Visualization</h2>
        <p className="text-gray-500">No skeleton data available. Please load data in the Data Input tab.</p>
      </div>
    );
  }

  const frames = getFramesArray();
  const totalFrames = frames.length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Skeleton Visualization</h2>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-3/4">
          <div className="relative border rounded">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full bg-gray-50"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />

            <div className="absolute bottom-2 right-2 bg-white bg-opacity-70 p-2 rounded">
              <div className="flex space-x-2">
                <button
                  className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                  </svg>
                </button>
                <button
                  className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                  </svg>
                </button>
                <button
                  className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={handleResetView}
                  title="Reset View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-gray-100 p-4 rounded">
            <div className="flex items-center mb-4">
              <button
                className="mr-2 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                  </svg>
                )}
              </button>

              <input
                type="range"
                min="0"
                max={totalFrames - 1}
                value={currentFrame}
                onChange={handleSeek}
                className="flex-grow mx-2"
              />

              <div className="ml-2 text-sm">
                Frame: {currentFrame + 1} / {totalFrames}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Playback Speed</label>
                <div className="flex items-center">
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={playbackSpeed}
                    onChange={handleSpeedChange}
                    className="flex-grow mr-2"
                  />
                  <span className="text-sm">{playbackSpeed.toFixed(1)}x</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Smoothing Level</label>
                <div className="flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={smoothingLevel}
                    onChange={handleSmoothingChange}
                    className="flex-grow mr-2"
                  />
                  <span className="text-sm">{smoothingLevel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-1/4">
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Display Options</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Display Mode</label>
              <select
                className="w-full p-2 border rounded"
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as any)}
              >
                <option value="original">Original Data</option>
                <option value="smoothed">Smoothed Data</option>
                <option value="constrained">Constrained Data</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showMarkerLabels"
                  checked={showMarkerLabels}
                  onChange={(e) => setShowMarkerLabels(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showMarkerLabels" className="text-sm">Show Marker Labels</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showJointLengths"
                  checked={showJointLengths}
                  onChange={(e) => setShowJointLengths(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showJointLengths" className="text-sm">Show Joint Lengths</label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showConstraints"
                  checked={showConstraints}
                  onChange={(e) => setShowConstraints(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showConstraints" className="text-sm">Apply Length Constraints</label>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-1">Legend</h4>
              <div className="text-xs space-y-1">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-400 mr-2 rounded-full"></div>
                  <span>Right side markers</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 mr-2 rounded-full"></div>
                  <span>Left side markers</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 mr-2 rounded-full"></div>
                  <span>Center markers</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-1">Statistics</h4>
              <div className="text-xs space-y-1">
                <div>Total Frames: {totalFrames}</div>
                <div>FPS: {skeletonData.rawData.fps || 30}</div>
                <div>Duration: {((totalFrames / (skeletonData.rawData.fps || 30)) || 0).toFixed(2)}s</div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-1">Interactions</h4>
              <div className="text-xs space-y-1">
                <div>• Drag to pan the view</div>
                <div>• Use the zoom buttons to zoom in/out</div>
                <div>• Click the play button to animate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonVisualizationView;
