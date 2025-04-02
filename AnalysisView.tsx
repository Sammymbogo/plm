import { useState, useEffect, useRef } from 'react';
import { Frame, Joint, MarkerIds, SkeletonModel } from '../types';
import { calculateDistance } from '../utils/skeletonUtils';

interface AnalysisViewProps {
  skeletonData: any;
}

const AnalysisView = ({ skeletonData }: AnalysisViewProps) => {
  const [analysisType, setAnalysisType] = useState<'trajectory' | 'jointLengths' | 'velocity'>('trajectory');
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
  const [selectedJoints, setSelectedJoints] = useState<number[]>([]);
  const [trajectoryData, setTrajectoryData] = useState<any>(null);
  const [jointLengthsData, setJointLengthsData] = useState<any>(null);
  const [velocityData, setVelocityData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Reset selections when the data changes
    if (skeletonData) {
      setSelectedMarkers([]);
      setSelectedJoints([]);
      setTrajectoryData(null);
      setJointLengthsData(null);
      setVelocityData(null);
    }
  }, [skeletonData]);

  const handleMarkerSelectionChange = (markerId: string) => {
    setSelectedMarkers(prev => {
      if (prev.includes(markerId)) {
        return prev.filter(id => id !== markerId);
      } else {
        return [...prev, markerId];
      }
    });
  };

  const handleJointSelectionChange = (jointIndex: number) => {
    setSelectedJoints(prev => {
      if (prev.includes(jointIndex)) {
        return prev.filter(idx => idx !== jointIndex);
      } else {
        return [...prev, jointIndex];
      }
    });
  };

  const generateAnalysis = () => {
    if (!skeletonData || !skeletonData.rawData || !skeletonData.rawData.frames) {
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      switch (analysisType) {
        case 'trajectory':
          generateTrajectoryAnalysis();
          break;
        case 'jointLengths':
          generateJointLengthsAnalysis();
          break;
        case 'velocity':
          generateVelocityAnalysis();
          break;
      }

      setIsLoading(false);
    }, 100);
  };

  const generateTrajectoryAnalysis = () => {
    if (!skeletonData || selectedMarkers.length === 0) return;

    const frames = skeletonData.rawData.frames;
    // Update the type definition to allow null values
    const data: { [markerId: string]: { x: (number | null)[], y: (number | null)[] } } = {};

    // Initialize data structure
    selectedMarkers.forEach(markerId => {
      data[markerId] = { x: [], y: [] };
    });

    // Collect data for each selected marker across all frames
    frames.forEach((frame: Frame) => {
      selectedMarkers.forEach(markerId => {
        const marker = frame.markers[markerId];
        if (marker && marker.isVisible) {
          data[markerId].x.push(marker.x);
          data[markerId].y.push(marker.y);
        } else {
          // Now this is allowed with the updated type definition
          data[markerId].x.push(null);
          data[markerId].y.push(null);
        }
      });
    });

    setTrajectoryData(data);

    // Also draw on canvas for visualization
    drawTrajectory(data);
  };

  const generateJointLengthsAnalysis = () => {
    if (!skeletonData || selectedJoints.length === 0) return;

    const frames = skeletonData.rawData.frames;
    const joints = skeletonData.skeletonModel.joints;
    const data: { [jointName: string]: { frameIndices: number[], lengths: number[] } } = {};

    // Initialize data structure
    selectedJoints.forEach(jointIndex => {
      const joint = joints[jointIndex];
      data[joint.name] = { frameIndices: [], lengths: [] };
    });

    // Collect data for each selected joint across all frames
    frames.forEach((frame: Frame, frameIndex: number) => {
      selectedJoints.forEach(jointIndex => {
        const joint = joints[jointIndex];
        const startMarker = frame.markers[joint.startMarkerId];
        const endMarker = frame.markers[joint.endMarkerId];

        if (startMarker && endMarker && startMarker.isVisible && endMarker.isVisible) {
          const length = calculateDistance(startMarker, endMarker);
          data[joint.name].frameIndices.push(frameIndex);
          data[joint.name].lengths.push(length);
        }
      });
    });

    setJointLengthsData(data);

    // Calculate joint length statistics
    calculateJointLengthStats(data);
  };

  const generateVelocityAnalysis = () => {
    if (!skeletonData || selectedMarkers.length === 0) return;

    const frames = skeletonData.rawData.frames;
    const fps = skeletonData.rawData.fps || 30;
    const data: { [markerId: string]: { frameIndices: number[], velocities: number[] } } = {};

    // Initialize data structure
    selectedMarkers.forEach(markerId => {
      data[markerId] = { frameIndices: [], velocities: [] };
    });

    // Collect velocity data for each selected marker across frames
    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i-1];
      const currentFrame = frames[i];

      selectedMarkers.forEach(markerId => {
        const prevMarker = prevFrame.markers[markerId];
        const currentMarker = currentFrame.markers[markerId];

        if (
          prevMarker && currentMarker &&
          prevMarker.isVisible && currentMarker.isVisible
        ) {
          const dx = currentMarker.x - prevMarker.x;
          const dy = currentMarker.y - prevMarker.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          const dt = 1 / fps; // Time between frames in seconds
          const velocity = distance / dt;

          data[markerId].frameIndices.push(i);
          data[markerId].velocities.push(velocity);
        }
      });
    }

    setVelocityData(data);

    // Calculate velocity statistics
    calculateVelocityStats(data);
  };

  const calculateJointLengthStats = (data: any) => {
    const stats: Record<string, { mean: number, std: number, min: number, max: number }> = {};

    Object.entries(data).forEach(([jointName, jointData]: [string, any]) => {
      const lengths = jointData.lengths;

      if (lengths.length > 0) {
        const sum = lengths.reduce((acc: number, val: number) => acc + val, 0);
        const mean = sum / lengths.length;

        const squaredDiffs = lengths.map((length: number) => (length - mean) ** 2);
        const variance = squaredDiffs.reduce((acc: number, val: number) => acc + val, 0) / lengths.length;
        const std = Math.sqrt(variance);

        const min = Math.min(...lengths);
        const max = Math.max(...lengths);

        stats[jointName] = { mean, std, min, max };
      }
    });

    return stats;
  };

  const calculateVelocityStats = (data: any) => {
    const stats: Record<string, { mean: number, std: number, min: number, max: number }> = {};

    Object.entries(data).forEach(([markerId, markerData]: [string, any]) => {
      const velocities = markerData.velocities;

      if (velocities.length > 0) {
        const sum = velocities.reduce((acc: number, val: number) => acc + val, 0);
        const mean = sum / velocities.length;

        const squaredDiffs = velocities.map((velocity: number) => (velocity - mean) ** 2);
        const variance = squaredDiffs.reduce((acc: number, val: number) => acc + val, 0) / velocities.length;
        const std = Math.sqrt(variance);

        const min = Math.min(...velocities);
        const max = Math.max(...velocities);

        stats[markerId] = { mean, std, min, max };
      }
    });

    return stats;
  };

  const drawTrajectory = (data: any) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find min/max values for scaling
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    Object.values(data).forEach((markerData: any) => {
      markerData.x.forEach((x: number | null) => {
        if (x !== null) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      });

      markerData.y.forEach((y: number | null) => {
        if (y !== null) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      });
    });

    // Add some padding
    const padding = 20;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Scale factors to fit the canvas
    const scaleX = (canvas.width - padding * 2) / rangeX;
    const scaleY = (canvas.height - padding * 2) / rangeY;

    // Draw each marker's trajectory
    Object.entries(data).forEach(([markerId, markerData]: [string, any]) => {
      const color = getMarkerColor(markerId);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let hasStarted = false;

      for (let i = 0; i < markerData.x.length; i++) {
        const x = markerData.x[i];
        const y = markerData.y[i];

        if (x !== null && y !== null) {
          // Scale and transform the coordinates to fit the canvas
          const canvasX = (x - minX) * scaleX + padding;
          const canvasY = (y - minY) * scaleY + padding;

          if (!hasStarted) {
            ctx.moveTo(canvasX, canvasY);
            hasStarted = true;
          } else {
            ctx.lineTo(canvasX, canvasY);
          }
        } else {
          // If there's a gap in the data, start a new path
          if (hasStarted) {
            ctx.stroke();
            hasStarted = false;
          }
        }
      }

      if (hasStarted) {
        ctx.stroke();
      }
    });
  };

  const getMarkerColor = (markerId: string): string => {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#8AC054', '#F06292', '#7986CB', '#4DD0E1'
    ];

    // Generate a consistent color based on the marker ID
    const index = markerId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const exportData = () => {
    if (!skeletonData) return;

    let data: any;
    let filename = 'motion_capture_data.json';

    switch (analysisType) {
      case 'trajectory':
        data = trajectoryData;
        filename = 'trajectory_analysis.json';
        break;
      case 'jointLengths':
        data = jointLengthsData;
        filename = 'joint_lengths_analysis.json';
        break;
      case 'velocity':
        data = velocityData;
        filename = 'velocity_analysis.json';
        break;
      default:
        data = skeletonData.rawData;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!skeletonData) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = 'motion_capture_data.csv';

    switch (analysisType) {
      case 'trajectory':
        if (trajectoryData) {
          // Header row
          const markers = Object.keys(trajectoryData);
          csvContent += 'Frame,' + markers.map(m => `${m}_X,${m}_Y`).join(',') + '\n';

          // Data rows
          const numFrames = trajectoryData[markers[0]].x.length;
          for (let i = 0; i < numFrames; i++) {
            let row = `${i},`;
            markers.forEach((markerId, idx) => {
              const x = trajectoryData[markerId].x[i] ?? '';
              const y = trajectoryData[markerId].y[i] ?? '';
              row += `${x},${y}`;
              if (idx < markers.length - 1) row += ',';
            });
            csvContent += row + '\n';
          }

          filename = 'trajectory_analysis.csv';
        }
        break;

      case 'jointLengths':
        if (jointLengthsData) {
          // Header row
          const joints = Object.keys(jointLengthsData);
          csvContent += 'Joint,Frame,Length\n';

          // Data rows
          joints.forEach(jointName => {
            const data = jointLengthsData[jointName];
            for (let i = 0; i < data.frameIndices.length; i++) {
              csvContent += `${jointName},${data.frameIndices[i]},${data.lengths[i]}\n`;
            }
          });

          filename = 'joint_lengths_analysis.csv';
        }
        break;

      case 'velocity':
        if (velocityData) {
          // Header row
          const markers = Object.keys(velocityData);
          csvContent += 'Marker,Frame,Velocity\n';

          // Data rows
          markers.forEach(markerId => {
            const data = velocityData[markerId];
            for (let i = 0; i < data.frameIndices.length; i++) {
              csvContent += `${markerId},${data.frameIndices[i]},${data.velocities[i]}\n`;
            }
          });

          filename = 'velocity_analysis.csv';
        }
        break;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Return early if no data is available
  if (!skeletonData || !skeletonData.rawData || !skeletonData.rawData.frames) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Data Analysis</h2>
        <p className="text-gray-500">No skeleton data available. Please load data in the Data Input tab.</p>
      </div>
    );
  }

  const availableMarkers = skeletonData.rawData.frames[0]
    ? Object.keys(skeletonData.rawData.frames[0].markers)
    : [];

  const availableJoints = skeletonData.skeletonModel?.joints || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Data Analysis</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="text-lg font-semibold mb-2">Analysis Parameters</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Analysis Type</label>
            <select
              className="w-full p-2 border rounded"
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value as any)}
            >
              <option value="trajectory">Marker Trajectory</option>
              <option value="jointLengths">Joint Lengths</option>
              <option value="velocity">Marker Velocity</option>
            </select>
          </div>

          {['trajectory', 'velocity'].includes(analysisType) && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Markers</label>
              <div className="max-h-60 overflow-y-auto border rounded p-2 bg-white">
                {availableMarkers.map(markerId => (
                  <div key={markerId} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`marker-${markerId}`}
                      checked={selectedMarkers.includes(markerId)}
                      onChange={() => handleMarkerSelectionChange(markerId)}
                      className="mr-2"
                    />
                    <label htmlFor={`marker-${markerId}`} className="text-sm">{markerId}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedMarkers.length} markers
              </p>
            </div>
          )}

          {analysisType === 'jointLengths' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Joints</label>
              <div className="max-h-60 overflow-y-auto border rounded p-2 bg-white">
                {availableJoints.map((joint: Joint, index: number) => (
                  <div key={index} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`joint-${index}`}
                      checked={selectedJoints.includes(index)}
                      onChange={() => handleJointSelectionChange(index)}
                      className="mr-2"
                    />
                    <label htmlFor={`joint-${index}`} className="text-sm">{joint.name}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedJoints.length} joints
              </p>
            </div>
          )}

          <div className="mt-4">
            <button
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              onClick={generateAnalysis}
              disabled={isLoading || (
                (analysisType === 'trajectory' || analysisType === 'velocity') && selectedMarkers.length === 0
              ) || (
                analysisType === 'jointLengths' && selectedJoints.length === 0
              )}
            >
              {isLoading ? 'Processing...' : 'Generate Analysis'}
            </button>
          </div>

          <div className="mt-4 flex space-x-2">
            <button
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              onClick={exportData}
              disabled={
                (analysisType === 'trajectory' && !trajectoryData) ||
                (analysisType === 'jointLengths' && !jointLengthsData) ||
                (analysisType === 'velocity' && !velocityData)
              }
            >
              Export JSON
            </button>
            <button
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              onClick={exportCSV}
              disabled={
                (analysisType === 'trajectory' && !trajectoryData) ||
                (analysisType === 'jointLengths' && !jointLengthsData) ||
                (analysisType === 'velocity' && !velocityData)
              }
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          {analysisType === 'trajectory' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Marker Trajectory Analysis</h3>

              <div className="border rounded p-2 bg-gray-50 mb-4">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  className="w-full bg-white"
                />
              </div>

              {trajectoryData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(trajectoryData).map(([markerId, data]: [string, any]) => {
                    const numPoints = data.x.filter((x: number | null) => x !== null).length;
                    return (
                      <div key={markerId} className="border p-2 rounded">
                        <h4 className="font-medium">{markerId}</h4>
                        <p className="text-sm">Data points: {numPoints}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {analysisType === 'jointLengths' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Joint Lengths Analysis</h3>

              {jointLengthsData ? (
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border p-2">Joint</th>
                          <th className="border p-2">Mean (px)</th>
                          <th className="border p-2">Std Dev</th>
                          <th className="border p-2">Min (px)</th>
                          <th className="border p-2">Max (px)</th>
                          <th className="border p-2">Samples</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(jointLengthsData).map(([jointName, data]: [string, any]) => {
                          const lengths = data.lengths;
                          const sum = lengths.reduce((acc: number, val: number) => acc + val, 0);
                          const mean = sum / lengths.length;

                          const squaredDiffs = lengths.map((length: number) => (length - mean) ** 2);
                          const variance = squaredDiffs.reduce((acc: number, val: number) => acc + val, 0) / lengths.length;
                          const std = Math.sqrt(variance);

                          const min = Math.min(...lengths);
                          const max = Math.max(...lengths);

                          return (
                            <tr key={jointName} className="hover:bg-gray-50">
                              <td className="border p-2">{jointName}</td>
                              <td className="border p-2">{mean.toFixed(2)}</td>
                              <td className="border p-2">{std.toFixed(2)}</td>
                              <td className="border p-2">{min.toFixed(2)}</td>
                              <td className="border p-2">{max.toFixed(2)}</td>
                              <td className="border p-2">{lengths.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded mt-4 text-sm">
                    <p>
                      <strong>Note:</strong> Joint length analysis shows how consistent the lengths are throughout the motion.
                      Ideally, the standard deviation should be low, indicating stable joint lengths.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Select joints and generate analysis to see results.</p>
              )}
            </div>
          )}

          {analysisType === 'velocity' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Marker Velocity Analysis</h3>

              {velocityData ? (
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border p-2">Marker</th>
                          <th className="border p-2">Mean (px/s)</th>
                          <th className="border p-2">Std Dev</th>
                          <th className="border p-2">Min (px/s)</th>
                          <th className="border p-2">Max (px/s)</th>
                          <th className="border p-2">Samples</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(velocityData).map(([markerId, data]: [string, any]) => {
                          const velocities = data.velocities;
                          const sum = velocities.reduce((acc: number, val: number) => acc + val, 0);
                          const mean = sum / velocities.length;

                          const squaredDiffs = velocities.map((velocity: number) => (velocity - mean) ** 2);
                          const variance = squaredDiffs.reduce((acc: number, val: number) => acc + val, 0) / velocities.length;
                          const std = Math.sqrt(variance);

                          const min = Math.min(...velocities);
                          const max = Math.max(...velocities);

                          return (
                            <tr key={markerId} className="hover:bg-gray-50">
                              <td className="border p-2">{markerId}</td>
                              <td className="border p-2">{mean.toFixed(2)}</td>
                              <td className="border p-2">{std.toFixed(2)}</td>
                              <td className="border p-2">{min.toFixed(2)}</td>
                              <td className="border p-2">{max.toFixed(2)}</td>
                              <td className="border p-2">{velocities.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded mt-4 text-sm">
                    <p>
                      <strong>Note:</strong> Velocity analysis shows how fast each marker is moving throughout the motion capture sequence.
                      This can help identify key moments in the motion, such as acceleration or deceleration phases.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Select markers and generate analysis to see results.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;
