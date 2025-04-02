import * as tf from '@tensorflow/tfjs';
import { Frame, Joint, Marker, MarkerIds, Point2D, SkeletonModel } from '../types';

/**
 * Calculate the Euclidean distance between two points
 */
export const calculateDistance = (p1: Point2D, p2: Point2D): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Initialize joint lengths based on the first frame of data
 */
export const initializeJointLengths = (joints: Joint[], frame: Frame): Joint[] => {
  return joints.map(joint => {
    const startMarker = frame.markers[joint.startMarkerId];
    const endMarker = frame.markers[joint.endMarkerId];

    if (startMarker && endMarker && startMarker.isVisible && endMarker.isVisible) {
      const length = calculateDistance(startMarker, endMarker);
      return { ...joint, length };
    }

    return joint;
  });
};

/**
 * Apply length constraints to the skeleton to maintain consistent limb lengths
 */
export const applyLengthConstraints = (frame: Frame, joints: Joint[], iterations: number = 5): Frame => {
  // Create a copy of the frame to work with
  const newFrame: Frame = {
    ...frame,
    markers: { ...frame.markers }
  };

  // Create a graph representation of the skeleton for efficient constraint solving
  const graph: Record<string, { neighbors: string[], originalPosition: Point2D, newPosition: Point2D, weight: number }> = {};

  // Initialize the graph with all markers from the frame
  Object.entries(frame.markers).forEach(([markerId, marker]) => {
    if (marker.isVisible) {
      graph[markerId] = {
        neighbors: [],
        originalPosition: { x: marker.x, y: marker.y },
        newPosition: { x: marker.x, y: marker.y },
        weight: marker.confidence
      };
    }
  });

  // Add connections between markers based on joints
  joints.forEach(joint => {
    const startMarker = frame.markers[joint.startMarkerId];
    const endMarker = frame.markers[joint.endMarkerId];

    if (startMarker && endMarker &&
        startMarker.isVisible && endMarker.isVisible &&
        joint.length > 0) {

      if (graph[joint.startMarkerId]) {
        graph[joint.startMarkerId].neighbors.push(joint.endMarkerId);
      }

      if (graph[joint.endMarkerId]) {
        graph[joint.endMarkerId].neighbors.push(joint.startMarkerId);
      }
    }
  });

  // Perform multiple iterations of constraint solving
  for (let iter = 0; iter < iterations; iter++) {
    // Apply constraints for each joint
    joints.forEach(joint => {
      const startNode = graph[joint.startMarkerId];
      const endNode = graph[joint.endMarkerId];

      if (startNode && endNode && joint.length > 0) {
        // Get current positions
        const startPos = startNode.newPosition;
        const endPos = endNode.newPosition;

        // Calculate current distance
        const currentDistance = calculateDistance(startPos, endPos);

        if (currentDistance > 0) {
          // Calculate the correction factor
          const correction = (joint.length - currentDistance) / currentDistance;

          // Calculate displacement vector
          const dx = endPos.x - startPos.x;
          const dy = endPos.y - startPos.y;

          // Calculate weights based on confidence
          const totalWeight = startNode.weight + endNode.weight;
          const startWeight = endNode.weight / totalWeight;
          const endWeight = startNode.weight / totalWeight;

          // Apply corrections to both points based on their weights
          startNode.newPosition = {
            x: startPos.x - dx * correction * startWeight * 0.5,
            y: startPos.y - dy * correction * startWeight * 0.5
          };

          endNode.newPosition = {
            x: endPos.x + dx * correction * endWeight * 0.5,
            y: endPos.y + dy * correction * endWeight * 0.5
          };
        }
      }
    });
  }

  // Update the frame with new marker positions
  Object.entries(graph).forEach(([markerId, node]) => {
    if (newFrame.markers[markerId]) {
      newFrame.markers[markerId] = {
        ...newFrame.markers[markerId],
        x: node.newPosition.x,
        y: node.newPosition.y
      };
    }
  });

  return newFrame;
};

/**
 * Blend marker-based (Vicon) and markerless (e.g., OpenPose) data
 * This uses a confidence-weighted approach to combine the two data sources
 */
export const blendMarkerAndMarkerlessData = (
  markerFrame: Frame,
  markerlessFrame: Frame,
  blendRatio: number = 0.5
): Frame => {
  const newFrame: Frame = {
    ...markerFrame,
    markers: { ...markerFrame.markers }
  };

  // For each marker in the marker-based frame
  Object.entries(markerFrame.markers).forEach(([markerId, marker]) => {
    const markerlessMarker = markerlessFrame.markers[markerId];

    // If we have data from both sources
    if (marker && markerlessMarker && marker.isVisible && markerlessMarker.isVisible) {
      // Calculate weights based on confidence scores and blend ratio
      const markerWeight = marker.confidence * (1 - blendRatio);
      const markerlessWeight = markerlessMarker.confidence * blendRatio;
      const totalWeight = markerWeight + markerlessWeight;

      if (totalWeight > 0) {
        // Blend the positions
        newFrame.markers[markerId] = {
          ...marker,
          x: (marker.x * markerWeight + markerlessMarker.x * markerlessWeight) / totalWeight,
          y: (marker.y * markerWeight + markerlessMarker.y * markerlessWeight) / totalWeight,
          confidence: Math.max(marker.confidence, markerlessMarker.confidence)
        };
      }
    }
  });

  return newFrame;
};

/**
 * Fill in missing markers based on nearby markers and joint length constraints
 */
export const fillMissingMarkers = (frame: Frame, joints: Joint[]): Frame => {
  const newFrame: Frame = {
    ...frame,
    markers: { ...frame.markers }
  };

  // Keep track of which markers we've already processed
  const processedMarkers = new Set<string>();

  // For each joint
  joints.forEach(joint => {
    const startMarker = frame.markers[joint.startMarkerId];
    const endMarker = frame.markers[joint.endMarkerId];

    // If one marker is visible and the other is not
    if (startMarker && !endMarker && startMarker.isVisible && joint.length > 0) {
      // Attempt to find the missing end marker's position

      // Find the nearest visible joint that connects to the start marker
      const connectedJoints = joints.filter(j =>
        (j.startMarkerId === joint.startMarkerId || j.endMarkerId === joint.startMarkerId) &&
        j.length > 0
      );

      let estimatedPosition: Point2D | null = null;

      // If we have connected joints, we can try to estimate the position
      if (connectedJoints.length > 0) {
        // For simplicity, use the first connected joint
        const connectedJoint = connectedJoints[0];
        const connectedMarkerId = connectedJoint.startMarkerId === joint.startMarkerId
          ? connectedJoint.endMarkerId
          : connectedJoint.startMarkerId;

        const connectedMarker = frame.markers[connectedMarkerId];

        if (connectedMarker && connectedMarker.isVisible) {
          // Calculate vectors
          const startToConnected = {
            x: connectedMarker.x - startMarker.x,
            y: connectedMarker.y - startMarker.y
          };

          // Normalize the vector
          const magnitude = Math.sqrt(startToConnected.x * startToConnected.x + startToConnected.y * startToConnected.y);

          if (magnitude > 0) {
            const normalizedVector = {
              x: startToConnected.x / magnitude,
              y: startToConnected.y / magnitude
            };

            // Rotate by 90 degrees to get a perpendicular vector
            const perpendicularVector = {
              x: -normalizedVector.y,
              y: normalizedVector.x
            };

            // Estimate the position of the missing marker
            estimatedPosition = {
              x: startMarker.x + normalizedVector.x * joint.length,
              y: startMarker.y + normalizedVector.y * joint.length
            };
          }
        }
      }

      // If we were able to estimate the position, add it to the frame
      if (estimatedPosition) {
        newFrame.markers[joint.endMarkerId] = {
          x: estimatedPosition.x,
          y: estimatedPosition.y,
          confidence: 0.5, // Lower confidence for estimated markers
          isVisible: true
        };

        processedMarkers.add(joint.endMarkerId);
      }
    }
    else if (endMarker && !startMarker && endMarker.isVisible && joint.length > 0) {
      // Similar logic for missing start marker
      // (implementation similar to the above case)

      const connectedJoints = joints.filter(j =>
        (j.startMarkerId === joint.endMarkerId || j.endMarkerId === joint.endMarkerId) &&
        j.length > 0
      );

      let estimatedPosition: Point2D | null = null;

      if (connectedJoints.length > 0) {
        const connectedJoint = connectedJoints[0];
        const connectedMarkerId = connectedJoint.startMarkerId === joint.endMarkerId
          ? connectedJoint.endMarkerId
          : connectedJoint.startMarkerId;

        const connectedMarker = frame.markers[connectedMarkerId];

        if (connectedMarker && connectedMarker.isVisible) {
          const endToConnected = {
            x: connectedMarker.x - endMarker.x,
            y: connectedMarker.y - endMarker.y
          };

          const magnitude = Math.sqrt(endToConnected.x * endToConnected.x + endToConnected.y * endToConnected.y);

          if (magnitude > 0) {
            const normalizedVector = {
              x: endToConnected.x / magnitude,
              y: endToConnected.y / magnitude
            };

            estimatedPosition = {
              x: endMarker.x + normalizedVector.x * joint.length,
              y: endMarker.y + normalizedVector.y * joint.length
            };
          }
        }
      }

      if (estimatedPosition) {
        newFrame.markers[joint.startMarkerId] = {
          x: estimatedPosition.x,
          y: estimatedPosition.y,
          confidence: 0.5,
          isVisible: true
        };

        processedMarkers.add(joint.startMarkerId);
      }
    }
  });

  return newFrame;
};

/**
 * Calculate lengths of all joints in a skeleton model from a frame
 */
export const calculateJointLengths = (skeletonModel: SkeletonModel, frame: Frame): Joint[] => {
  return skeletonModel.joints.map(joint => {
    const startMarker = frame.markers[joint.startMarkerId];
    const endMarker = frame.markers[joint.endMarkerId];

    if (startMarker && endMarker && startMarker.isVisible && endMarker.isVisible) {
      const length = calculateDistance(startMarker, endMarker);
      return { ...joint, length };
    }

    return joint;
  });
};

/**
 * Project 3D Vicon markers to 2D using a simple projection matrix
 * In a real application, this would use proper camera calibration
 */
export const projectMarkersTo2D = (markers3D: Record<string, { x: number, y: number, z: number }>,
                                  projectionMatrix: number[][]): Record<string, Point2D> => {
  const markers2D: Record<string, Point2D> = {};

  Object.entries(markers3D).forEach(([markerId, position]) => {
    // Simple projection using matrix multiplication
    const x = projectionMatrix[0][0] * position.x + projectionMatrix[0][1] * position.y + projectionMatrix[0][2] * position.z + projectionMatrix[0][3];
    const y = projectionMatrix[1][0] * position.x + projectionMatrix[1][1] * position.y + projectionMatrix[1][2] * position.z + projectionMatrix[1][3];
    const w = projectionMatrix[2][0] * position.x + projectionMatrix[2][1] * position.y + projectionMatrix[2][2] * position.z + projectionMatrix[2][3];

    // Perform perspective division
    markers2D[markerId] = {
      x: x / w,
      y: y / w
    };
  });

  return markers2D;
};

/**
 * Synchronize markerless and marker-based data by time alignment
 */
export const synchronizeData = (
  markerFrames: Frame[],
  markerlessFrames: Frame[],
  syncWindowSize: number = 10
): { markerFrames: Frame[], markerlessFrames: Frame[] } => {
  // This is a simplistic implementation - in a real application, you would use
  // more sophisticated techniques like cross-correlation or dynamic time warping

  // Ensure we have enough frames to work with
  if (markerFrames.length < syncWindowSize || markerlessFrames.length < syncWindowSize) {
    return { markerFrames, markerlessFrames };
  }

  // Calculate average movement in both sequences
  const calculateMovement = (frames: Frame[]): number[] => {
    const movements: number[] = [];

    for (let i = 1; i < frames.length; i++) {
      let totalMovement = 0;
      let numMarkers = 0;

      Object.keys(frames[i].markers).forEach(markerId => {
        const currentMarker = frames[i].markers[markerId];
        const prevMarker = frames[i-1].markers[markerId];

        if (currentMarker && prevMarker && currentMarker.isVisible && prevMarker.isVisible) {
          totalMovement += calculateDistance(currentMarker, prevMarker);
          numMarkers++;
        }
      });

      movements.push(numMarkers > 0 ? totalMovement / numMarkers : 0);
    }

    return movements;
  };

  const markerMovements = calculateMovement(markerFrames);
  const markerlessMovements = calculateMovement(markerlessFrames);

  // Find the best match using a sliding window approach
  let bestOffset = 0;
  let bestCorrelation = -Infinity;

  const maxOffset = Math.min(
    Math.floor(markerFrames.length / 4),
    Math.floor(markerlessFrames.length / 4)
  );

  for (let offset = -maxOffset; offset <= maxOffset; offset++) {
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < syncWindowSize; i++) {
      const markerIdx = i;
      const markerlessIdx = i + offset;

      if (markerIdx >= 0 && markerIdx < markerMovements.length &&
          markerlessIdx >= 0 && markerlessIdx < markerlessMovements.length) {
        correlation += markerMovements[markerIdx] * markerlessMovements[markerlessIdx];
        count++;
      }
    }

    if (count > 0) {
      correlation /= count;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
  }

  // Adjust the frames based on the best offset
  if (bestOffset > 0) {
    // Marker-based data starts earlier
    return {
      markerFrames: markerFrames.slice(bestOffset),
      markerlessFrames
    };
  } else if (bestOffset < 0) {
    // Markerless data starts earlier
    return {
      markerFrames,
      markerlessFrames: markerlessFrames.slice(-bestOffset)
    };
  }

  // No adjustment needed
  return { markerFrames, markerlessFrames };
};

/**
 * Create a default skeleton model with all markers set to initial positions
 */
export const createDefaultSkeletonModel = (): SkeletonModel => {
  // Create markers with default positions (will be updated with actual data)
  const markers: Marker[] = Object.values(MarkerIds).map(markerId => ({
    id: markerId,
    name: markerId,
    position: { x: 0, y: 0 },
    segment: 'unknown',
    confidence: 0,
    isVisible: false
  }));

  return {
    id: 'default-skeleton',
    name: 'Default Skeleton Model',
    markers,
    joints: []
  };
};

/**
 * Convert TensorFlow.js pose detection result to our marker format
 */
export const convertTFJSPoseToMarkers = (
  pose: any,
  markerMapping: Record<string, string>
): Record<string, Point2D & { confidence: number, isVisible: boolean }> => {
  const markers: Record<string, Point2D & { confidence: number, isVisible: boolean }> = {};

  if (pose && pose.keypoints) {
    pose.keypoints.forEach((keypoint: any) => {
      const markerId = markerMapping[keypoint.name];

      if (markerId) {
        markers[markerId] = {
          x: keypoint.x,
          y: keypoint.y,
          confidence: keypoint.score || 0,
          isVisible: (keypoint.score || 0) > 0.2 // Threshold for visibility
        };
      }
    });
  }

  return markers;
};

/**
 * Convert OpenPose format to our marker format
 */
export const convertOpenPoseToMarkers = (
  openPoseData: any,
  markerMapping: Record<string, string>
): Record<string, Point2D & { confidence: number, isVisible: boolean }> => {
  const markers: Record<string, Point2D & { confidence: number, isVisible: boolean }> = {};

  if (openPoseData && openPoseData.people && openPoseData.people.length > 0) {
    const person = openPoseData.people[0]; // Assume first person

    if (person.pose_keypoints_2d) {
      // OpenPose keypoints are stored as [x1, y1, c1, x2, y2, c2, ...] array
      for (let i = 0; i < person.pose_keypoints_2d.length / 3; i++) {
        const x = person.pose_keypoints_2d[i * 3];
        const y = person.pose_keypoints_2d[i * 3 + 1];
        const confidence = person.pose_keypoints_2d[i * 3 + 2];

        const openposeKeyName = `openpose_kpt_${i}`;
        const markerId = markerMapping[openposeKeyName];

        if (markerId) {
          markers[markerId] = {
            x,
            y,
            confidence,
            isVisible: confidence > 0.2 // Threshold for visibility
          };
        }
      }
    }
  }

  return markers;
};

/**
 * Apply a temporal smoothing filter to the skeleton motion
 */
export const applyTemporalSmoothing = (frames: Frame[], windowSize: number = 5): Frame[] => {
  if (frames.length <= 1 || windowSize <= 1) {
    return frames;
  }

  const smoothedFrames: Frame[] = [];

  for (let i = 0; i < frames.length; i++) {
    const newFrame: Frame = {
      ...frames[i],
      markers: { ...frames[i].markers }
    };

    // For each marker in the current frame
    Object.keys(frames[i].markers).forEach(markerId => {
      let sumX = 0;
      let sumY = 0;
      let sumConfidence = 0;
      let count = 0;

      // Calculate the window start and end
      const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
      const windowEnd = Math.min(frames.length - 1, i + Math.floor(windowSize / 2));

      // Sum up the positions from frames in the window
      for (let j = windowStart; j <= windowEnd; j++) {
        const marker = frames[j].markers[markerId];

        if (marker && marker.isVisible) {
          sumX += marker.x * marker.confidence;
          sumY += marker.y * marker.confidence;
          sumConfidence += marker.confidence;
          count++;
        }
      }

      // If we have data in the window, update the marker
      if (count > 0 && sumConfidence > 0) {
        newFrame.markers[markerId] = {
          x: sumX / sumConfidence,
          y: sumY / sumConfidence,
          confidence: frames[i].markers[markerId].confidence,
          isVisible: frames[i].markers[markerId].isVisible
        };
      }
    });

    smoothedFrames.push(newFrame);
  }

  return smoothedFrames;
};
