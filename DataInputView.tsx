import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import {
  createDefaultSkeletonModel,
  initializeJointLengths,
} from '../utils/skeletonUtils';
import { defaultJoints, Joint, MarkerIds, SkeletonModel, markerIdToName, markerIdToSegment } from '../types';

interface DataInputViewProps {
  onDataLoaded: (data: any) => void;
}

const DataInputView = ({ onDataLoaded }: DataInputViewProps) => {
  const [skeletonModel, setSkeletonModel] = useState<SkeletonModel>(createDefaultSkeletonModel());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'vicon' | 'openpose' | 'csv' | 'json'>('csv');
  const [customMarkerMapping, setCustomMarkerMapping] = useState<Record<string, string>>({});
  const [joints, setJoints] = useState<Joint[]>(defaultJoints);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load TensorFlow.js model for pose estimation if needed
  useEffect(() => {
    async function loadTFModels() {
      try {
        // Load TensorFlow.js models for pose detection
        await tf.ready();
        console.log('TensorFlow.js is ready');
      } catch (error) {
        console.error('Error loading TensorFlow.js', error);
        setError('Failed to load TensorFlow.js models');
      }
    }

    loadTFModels();
  }, []);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError(null);
    }
  };

  // Handle file type selection
  const handleFileTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFileType(event.target.value as 'vicon' | 'openpose' | 'csv' | 'json');
  };

  // Process the uploaded file
  const processFile = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          let parsedData;

          // Parse the data based on file type
          switch (fileType) {
            case 'vicon':
              parsedData = parseViconData(content);
              break;
            case 'openpose':
              parsedData = parseOpenPoseData(content);
              break;
            case 'csv':
              parsedData = parseCSVData(content);
              break;
            case 'json':
              parsedData = JSON.parse(content);
              break;
            default:
              throw new Error('Unsupported file type');
          }

          // Initialize the skeleton model with the data
          const model = initializeSkeletonModel(parsedData);
          setSkeletonModel(model);

          // Pass the data to the parent component
          onDataLoaded({
            skeletonModel: model,
            rawData: parsedData,
            fileType
          });

          setIsLoading(false);
          setUploadProgress(100);

        } catch (error) {
          console.error('Error processing file', error);
          setError('Failed to process the file. Please check the format.');
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error reading the file');
        setIsLoading(false);
      };

      if (fileType === 'csv' || fileType === 'vicon') {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsText(selectedFile);
      }

    } catch (error) {
      console.error('Error processing file', error);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  // Parse Vicon data format
  const parseViconData = (content: string) => {
    // This is a simplified parser for Vicon data
    // In a real application, you would need a more robust parser
    const lines = content.split('\n');
    const headers = lines[0].split(',');

    const frames = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(',');
      const frame: any = { frameNumber: i - 1, markers: {} };

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].trim();
        const value = parseFloat(values[j]);

        if (header.includes('_x')) {
          const markerId = header.replace('_x', '');
          if (!frame.markers[markerId]) {
            frame.markers[markerId] = { x: 0, y: 0, isVisible: true, confidence: 1.0 };
          }
          frame.markers[markerId].x = value;
        } else if (header.includes('_y')) {
          const markerId = header.replace('_y', '');
          if (!frame.markers[markerId]) {
            frame.markers[markerId] = { x: 0, y: 0, isVisible: true, confidence: 1.0 };
          }
          frame.markers[markerId].y = value;
        }
      }

      frames.push(frame);
    }

    return { frames, type: 'vicon' };
  };

  // Parse OpenPose data format
  const parseOpenPoseData = (content: string) => {
    try {
      const data = JSON.parse(content);

      // OpenPose data is typically in an array of frames
      const frames = data.map((frame: any, index: number) => {
        const markers: Record<string, any> = {};

        if (frame.people && frame.people.length > 0) {
          const person = frame.people[0]; // Assume first person

          if (person.pose_keypoints_2d) {
            // OpenPose keypoints are stored as [x1, y1, c1, x2, y2, c2, ...] array
            for (let i = 0; i < person.pose_keypoints_2d.length / 3; i++) {
              const x = person.pose_keypoints_2d[i * 3];
              const y = person.pose_keypoints_2d[i * 3 + 1];
              const confidence = person.pose_keypoints_2d[i * 3 + 2];

              // Map OpenPose keypoints to our marker system
              // This is a simplified mapping, would need to be customized for your specific needs
              const openposeKeyName = `openpose_${i}`;
              const markerId = customMarkerMapping[openposeKeyName] || openposeKeyName;

              markers[markerId] = {
                x,
                y,
                confidence,
                isVisible: confidence > 0.2 // Threshold for visibility
              };
            }
          }
        }

        return {
          frameNumber: index,
          markers
        };
      });

      return { frames, type: 'openpose' };
    } catch (error) {
      console.error('Error parsing OpenPose data', error);
      throw new Error('Invalid OpenPose data format');
    }
  };

  // Parse CSV data format
  const parseCSVData = (content: string) => {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());

    const frames = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(',');
      const frame: any = {
        frameNumber: i - 1,
        timestamp: parseFloat(values[0]) || i - 1,
        markers: {}
      };

      // Process each marker column
      // Assuming format: MarkerName_X, MarkerName_Y
      for (let j = 1; j < headers.length; j++) {
        const header = headers[j];
        const value = parseFloat(values[j]);

        if (isNaN(value)) continue;

        if (header.endsWith('_X') || header.endsWith('_x')) {
          const markerId = header.slice(0, -2);
          if (!frame.markers[markerId]) {
            frame.markers[markerId] = { x: 0, y: 0, isVisible: true, confidence: 1.0 };
          }
          frame.markers[markerId].x = value;
        } else if (header.endsWith('_Y') || header.endsWith('_y')) {
          const markerId = header.slice(0, -2);
          if (!frame.markers[markerId]) {
            frame.markers[markerId] = { x: 0, y: 0, isVisible: true, confidence: 1.0 };
          }
          frame.markers[markerId].y = value;
        }
      }

      frames.push(frame);
    }

    return { frames, type: 'csv' };
  };

  // Initialize the skeleton model with the parsed data
  const initializeSkeletonModel = (parsedData: any) => {
    const model = createDefaultSkeletonModel();

    // If we have frames, use the first frame to initialize joint lengths
    if (parsedData.frames && parsedData.frames.length > 0) {
      const frameWithMarkers = parsedData.frames.find((frame: any) =>
        Object.keys(frame.markers).length > 0
      );

      if (frameWithMarkers) {
        const initializedJoints = initializeJointLengths(defaultJoints, frameWithMarkers);
        setJoints(initializedJoints);

        return {
          ...model,
          joints: initializedJoints
        };
      }
    }

    return model;
  };

  // Handle joint parameter changes
  const handleJointChange = (jointIndex: number, field: keyof Joint, value: string | number) => {
    const updatedJoints = [...joints];
    updatedJoints[jointIndex] = {
      ...updatedJoints[jointIndex],
      [field]: typeof value === 'string' ? value : Number(value)
    };
    setJoints(updatedJoints);

    setSkeletonModel({
      ...skeletonModel,
      joints: updatedJoints
    });
  };

  // Generate a simple mockup dataset for testing
  const generateMockData = () => {
    // Create a simple circular motion animation with all markers
    const frames = [];
    const radius = 200;
    const centerX = 300;
    const centerY = 300;

    for (let frameNumber = 0; frameNumber < 100; frameNumber++) {
      const angle = (frameNumber / 100) * Math.PI * 2;

      const hipX = centerX + radius * 0.2 * Math.cos(angle);
      const hipY = centerY + radius * 0.1 * Math.sin(angle);

      const frame: any = {
        frameNumber,
        timestamp: frameNumber / 30, // 30 fps
        markers: {}
      };

      // Set positions for key markers
      // Head
      frame.markers[MarkerIds.LHEAD] = {
        x: hipX - 10,
        y: hipY - 100,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RHEAD] = {
        x: hipX + 10,
        y: hipY - 100,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.C7T1] = {
        x: hipX,
        y: hipY - 80,
        isVisible: true,
        confidence: 1.0
      };

      // Shoulders
      frame.markers[MarkerIds.LSAP] = {
        x: hipX - 30,
        y: hipY - 70,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RSAP] = {
        x: hipX + 30,
        y: hipY - 70,
        isVisible: true,
        confidence: 1.0
      };

      // Arms
      frame.markers[MarkerIds.LUM] = {
        x: hipX - 40,
        y: hipY - 40 + 10 * Math.sin(angle * 2),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RUM] = {
        x: hipX + 40,
        y: hipY - 40 + 10 * Math.sin(angle * 2 + Math.PI),
        isVisible: true,
        confidence: 1.0
      };

      frame.markers[MarkerIds.LUS] = {
        x: hipX - 45,
        y: hipY - 10 + 20 * Math.sin(angle * 2),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RUS] = {
        x: hipX + 45,
        y: hipY - 10 + 20 * Math.sin(angle * 2 + Math.PI),
        isVisible: true,
        confidence: 1.0
      };

      // Hips
      frame.markers[MarkerIds.LASI] = {
        x: hipX - 20,
        y: hipY,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RASI] = {
        x: hipX + 20,
        y: hipY,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.LPSI] = {
        x: hipX - 15,
        y: hipY + 5,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RPSI] = {
        x: hipX + 15,
        y: hipY + 5,
        isVisible: true,
        confidence: 1.0
      };

      // Legs
      const leftLegPhase = angle + Math.PI / 6;
      const rightLegPhase = angle - Math.PI / 6;

      frame.markers[MarkerIds.LHJC] = {
        x: hipX - 15,
        y: hipY + 10,
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RHJC] = {
        x: hipX + 15,
        y: hipY + 10,
        isVisible: true,
        confidence: 1.0
      };

      frame.markers[MarkerIds.LKJC] = {
        x: hipX - 20 + 10 * Math.sin(leftLegPhase),
        y: hipY + 60 + 5 * Math.cos(leftLegPhase),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RKJC] = {
        x: hipX + 20 + 10 * Math.sin(rightLegPhase),
        y: hipY + 60 + 5 * Math.cos(rightLegPhase),
        isVisible: true,
        confidence: 1.0
      };

      frame.markers[MarkerIds.LAJC] = {
        x: hipX - 20 + 20 * Math.sin(leftLegPhase),
        y: hipY + 110 + 5 * Math.cos(leftLegPhase),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RAJC] = {
        x: hipX + 20 + 20 * Math.sin(rightLegPhase),
        y: hipY + 110 + 5 * Math.cos(rightLegPhase),
        isVisible: true,
        confidence: 1.0
      };

      // Feet
      frame.markers[MarkerIds.LHEE] = {
        x: hipX - 25 + 15 * Math.sin(leftLegPhase),
        y: hipY + 120 + 5 * Math.cos(leftLegPhase),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RHEE] = {
        x: hipX + 25 + 15 * Math.sin(rightLegPhase),
        y: hipY + 120 + 5 * Math.cos(rightLegPhase),
        isVisible: true,
        confidence: 1.0
      };

      frame.markers[MarkerIds.LTOE] = {
        x: hipX - 15 + 30 * Math.sin(leftLegPhase),
        y: hipY + 125 + 5 * Math.cos(leftLegPhase),
        isVisible: true,
        confidence: 1.0
      };
      frame.markers[MarkerIds.RTOE] = {
        x: hipX + 15 + 30 * Math.sin(rightLegPhase),
        y: hipY + 125 + 5 * Math.cos(rightLegPhase),
        isVisible: true,
        confidence: 1.0
      };

      frames.push(frame);
    }

    const mockData = {
      frames,
      type: 'mock',
      fps: 30,
      duration: frames.length / 30,
      startTime: 0,
      endTime: frames.length / 30
    };

    // Initialize the skeleton model with the mock data
    const model = initializeSkeletonModel(mockData);
    setSkeletonModel(model);

    // Pass the data to the parent component
    onDataLoaded({
      skeletonModel: model,
      rawData: mockData,
      fileType: 'mock'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Data Input</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Upload Motion Capture Data</h3>

        <div className="flex flex-col space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File Type</label>
            <select
              className="w-full p-2 border rounded"
              value={fileType}
              onChange={handleFileTypeChange}
            >
              <option value="csv">CSV File</option>
              <option value="vicon">Vicon Data</option>
              <option value="openpose">OpenPose JSON</option>
              <option value="json">Generic JSON</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Upload File</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              onClick={processFile}
              disabled={!selectedFile || isLoading}
            >
              {isLoading ? 'Processing...' : 'Process File'}
            </button>

            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={generateMockData}
            >
              Generate Mock Data
            </button>
          </div>

          {isLoading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          {error && (
            <div className="text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Skeleton Parameters</h3>

        <div className="overflow-auto max-h-60">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border text-left">Joint Name</th>
                <th className="p-2 border text-left">Start Marker</th>
                <th className="p-2 border text-left">End Marker</th>
                <th className="p-2 border text-left">Length</th>
              </tr>
            </thead>
            <tbody>
              {joints.slice(0, 10).map((joint, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="p-2 border">{joint.name}</td>
                  <td className="p-2 border">{markerIdToName[joint.startMarkerId] || joint.startMarkerId}</td>
                  <td className="p-2 border">{markerIdToName[joint.endMarkerId] || joint.endMarkerId}</td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={joint.length}
                      onChange={e => handleJointChange(index, 'length', parseFloat(e.target.value))}
                      className="w-20 p-1 border rounded"
                    />
                  </td>
                </tr>
              ))}
              {joints.length > 10 && (
                <tr>
                  <td colSpan={4} className="p-2 border text-center text-sm text-gray-500">
                    ... {joints.length - 10} more joints ...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Instructions</h3>
        <div className="bg-gray-50 p-4 rounded text-sm">
          <p className="mb-2">
            <strong>1. Select data type:</strong> Choose the type of motion capture data you want to load.
          </p>
          <p className="mb-2">
            <strong>2. Upload file:</strong> Select a file from your computer.
          </p>
          <p className="mb-2">
            <strong>3. Process data:</strong> Click "Process File" to load the data or "Generate Mock Data" for a sample.
          </p>
          <p className="mb-2">
            <strong>4. Adjust parameters:</strong> Modify the joint lengths if needed to match your subject.
          </p>
          <p>
            <strong>5. Proceed:</strong> Once data is loaded, you can proceed to the visualization tab.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataInputView;
