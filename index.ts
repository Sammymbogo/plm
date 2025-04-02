// Define a point in 2D space
export interface Point2D {
  x: number;
  y: number;
}

// Define a single marker (reflective ball from Vicon system)
export interface Marker {
  id: string;  // Marker ID (e.g., RMMA, LMMA)
  name: string; // Full name of marker (e.g., Right medial malleolus)
  position: Point2D; // Position in 2D space
  segment: string; // Body segment (e.g., Foot, Ankle)
  confidence: number; // Confidence score (0-1)
  isVisible: boolean; // Whether the marker is visible in the current frame
}

// Define a joint that connects two markers
export interface Joint {
  startMarkerId: string;
  endMarkerId: string;
  length: number; // The length constraint
  name: string;
}

// Define a skeleton model which consists of markers and joints
export interface SkeletonModel {
  id: string;
  name: string;
  markers: Marker[];
  joints: Joint[];
}

// Define a frame of motion capture data
export interface Frame {
  frameNumber: number;
  timestamp: number;
  markers: Record<string, Point2D & { confidence: number; isVisible: boolean }>;
}

// Define a motion capture sequence
export interface MotionCaptureSequence {
  id: string;
  name: string;
  skeletonModel: SkeletonModel;
  frames: Frame[];
  fps: number;
  duration: number;
  startTime: number;
  endTime: number;
}

// Define the standard marker IDs based on the tables provided
export enum MarkerIds {
  // Foot markers
  RMMA = "RMMA", // Right medial malleolus
  LMMA = "LMMA", // Left medial malleolus
  RLMA = "RLMA", // Right lateral malleolus
  LLMA = "LLMA", // Left lateral malleolus
  RFOO = "RFOO", // Right navicular tuberosity
  LFOO = "LFOO", // Left navicular tuberosity
  RTOE = "RTOE", // Right tuberosity of 5th metatarsal bone
  LTOE = "LTOE", // Left tuberosity of 5th metatarsal bone
  RBTO = "RBTO", // Right foot big toe
  LBTO = "LBTO", // Left foot big toe

  // Ankle markers
  RAJC = "RAJC", // Right Ankle joint center
  LAJC = "LAJC", // Left Ankle joint center

  // Heel markers
  RHEE = "RHEE", // Right heel
  LHEE = "LHEE", // Left heel

  // Shoulder markers
  RSAP = "RSAP", // Right shoulder acromial process
  LSAP = "LSAP", // Left shoulder acromial process

  // Elbow markers
  RUM = "RUM", // Right humerus medial epicondyle
  LUM = "LUM", // Left humerus medial epicondyle
  RRM = "RRM", // Right humerus lateral epicondyle
  LRM = "LRM", // Left humerus lateral epicondyle

  // Wrist markers
  RUS = "RUS", // Right ulnar styloid
  LUS = "LUS", // Left ulnar styloid

  // Neck markers
  C7T1 = "C7T1", // C7 and T1 junction

  // Head markers
  RHEAD = "RHEAD", // Right ear channel
  LHEAD = "LHEAD", // Left ear channel

  // Pelvis markers
  RASI = "RASI", // Right Anterior superior iliac spine
  LASI = "LASI", // Left Anterior superior iliac spine
  RPSI = "RPSI", // Right Posterior superior iliac spine
  LPSI = "LPSI", // Left Posterior superior iliac spine

  // Hip markers
  RHJC = "RHJC", // Right hip joint center
  LHJC = "LHJC", // Left hip joint center
  RTRO = "RTRO", // Right greater trochanter
  LTRO = "LTRO", // Left greater trochanter

  // Thigh markers
  RTHI = "RTHI", // Right thigh wand marker
  LTHI = "LTHI", // Left thigh wand marker
  RLFC = "RLFC", // Right lateral femoral epicondyle center
  LLFC = "LLFC", // Left lateral femoral epicondyle center
  RMFC = "RMFC", // Right medial femoral epicondyle center
  LMFC = "LMFC", // Left medial femoral epicondyle center

  // Knee markers
  RKJC = "RKJC", // Right Knee joint center
  LKJC = "LKJC", // Left Knee joint center

  // Shank markers
  RSHA = "RSHA", // Right head of fibula
  LSHA = "LSHA", // Left head of fibula
  RTT = "RTT", // Right tibia tuberosity
  LTT = "LTT", // Left tibia tuberosity
}

// Define segments
export enum BodySegments {
  HEAD = "Head",
  NECK = "Neck",
  SHOULDER = "Shoulder",
  ELBOW = "Elbow",
  WRIST = "Wrist",
  PELVIS = "Pelvis",
  HIP = "Hip",
  THIGH = "Thigh",
  KNEE = "Knee",
  SHANK = "Shank",
  ANKLE = "Ankle",
  FOOT = "Foot"
}

// Mapping from marker IDs to full names
export const markerIdToName: Record<string, string> = {
  [MarkerIds.RMMA]: "Right medial malleolus",
  [MarkerIds.LMMA]: "Left medial malleolus",
  [MarkerIds.RLMA]: "Right lateral malleolus",
  [MarkerIds.LLMA]: "Left lateral malleolus",
  [MarkerIds.RFOO]: "Right navicular tuberosity",
  [MarkerIds.LFOO]: "Left navicular tuberosity",
  [MarkerIds.RTOE]: "Right tuberosity of 5th metatarsal bone",
  [MarkerIds.LTOE]: "Left tuberosity of 5th metatarsal bone",
  [MarkerIds.RBTO]: "Right foot big toe",
  [MarkerIds.LBTO]: "Left foot big toe",
  [MarkerIds.RAJC]: "Right Ankle joint center",
  [MarkerIds.LAJC]: "Left Ankle joint center",
  [MarkerIds.RHEE]: "Right heel",
  [MarkerIds.LHEE]: "Left heel",
  [MarkerIds.RSAP]: "Right shoulder acromial process",
  [MarkerIds.LSAP]: "Left shoulder acromial process",
  [MarkerIds.RUM]: "Right humerus medial epicondyle",
  [MarkerIds.LUM]: "Left humerus medial epicondyle",
  [MarkerIds.RRM]: "Right humerus lateral epicondyle",
  [MarkerIds.LRM]: "Left humerus lateral epicondyle",
  [MarkerIds.RUS]: "Right ulnar styloid",
  [MarkerIds.LUS]: "Left ulnar styloid",
  [MarkerIds.C7T1]: "C7 and T1 junction",
  [MarkerIds.RHEAD]: "Right ear channel",
  [MarkerIds.LHEAD]: "Left ear channel",
  [MarkerIds.RASI]: "Right Anterior superior iliac spine",
  [MarkerIds.LASI]: "Left Anterior superior iliac spine",
  [MarkerIds.RPSI]: "Right Posterior superior iliac spine",
  [MarkerIds.LPSI]: "Left Posterior superior iliac spine",
  [MarkerIds.RHJC]: "Right hip joint center",
  [MarkerIds.LHJC]: "Left hip joint center",
  [MarkerIds.RTRO]: "Right greater trochanter",
  [MarkerIds.LTRO]: "Left greater trochanter",
  [MarkerIds.RTHI]: "Right thigh wand marker",
  [MarkerIds.LTHI]: "Left thigh wand marker",
  [MarkerIds.RLFC]: "Right lateral femoral epicondyle center",
  [MarkerIds.LLFC]: "Left lateral femoral epicondyle center",
  [MarkerIds.RMFC]: "Right medial femoral epicondyle center",
  [MarkerIds.LMFC]: "Left medial femoral epicondyle center",
  [MarkerIds.RKJC]: "Right Knee joint center",
  [MarkerIds.LKJC]: "Left Knee joint center",
  [MarkerIds.RSHA]: "Right head of fibula",
  [MarkerIds.LSHA]: "Left head of fibula",
  [MarkerIds.RTT]: "Right tibia tuberosity",
  [MarkerIds.LTT]: "Left tibia tuberosity"
};

// Mapping from marker IDs to body segments
export const markerIdToSegment: Record<string, BodySegments> = {
  [MarkerIds.RMMA]: BodySegments.FOOT,
  [MarkerIds.LMMA]: BodySegments.FOOT,
  [MarkerIds.RLMA]: BodySegments.FOOT,
  [MarkerIds.LLMA]: BodySegments.FOOT,
  [MarkerIds.RFOO]: BodySegments.FOOT,
  [MarkerIds.LFOO]: BodySegments.FOOT,
  [MarkerIds.RTOE]: BodySegments.FOOT,
  [MarkerIds.LTOE]: BodySegments.FOOT,
  [MarkerIds.RBTO]: BodySegments.FOOT,
  [MarkerIds.LBTO]: BodySegments.FOOT,
  [MarkerIds.RAJC]: BodySegments.ANKLE,
  [MarkerIds.LAJC]: BodySegments.ANKLE,
  [MarkerIds.RHEE]: BodySegments.FOOT,
  [MarkerIds.LHEE]: BodySegments.FOOT,
  [MarkerIds.RSAP]: BodySegments.SHOULDER,
  [MarkerIds.LSAP]: BodySegments.SHOULDER,
  [MarkerIds.RUM]: BodySegments.ELBOW,
  [MarkerIds.LUM]: BodySegments.ELBOW,
  [MarkerIds.RRM]: BodySegments.ELBOW,
  [MarkerIds.LRM]: BodySegments.ELBOW,
  [MarkerIds.RUS]: BodySegments.WRIST,
  [MarkerIds.LUS]: BodySegments.WRIST,
  [MarkerIds.C7T1]: BodySegments.NECK,
  [MarkerIds.RHEAD]: BodySegments.HEAD,
  [MarkerIds.LHEAD]: BodySegments.HEAD,
  [MarkerIds.RASI]: BodySegments.PELVIS,
  [MarkerIds.LASI]: BodySegments.PELVIS,
  [MarkerIds.RPSI]: BodySegments.PELVIS,
  [MarkerIds.LPSI]: BodySegments.PELVIS,
  [MarkerIds.RHJC]: BodySegments.HIP,
  [MarkerIds.LHJC]: BodySegments.HIP,
  [MarkerIds.RTRO]: BodySegments.HIP,
  [MarkerIds.LTRO]: BodySegments.HIP,
  [MarkerIds.RTHI]: BodySegments.THIGH,
  [MarkerIds.LTHI]: BodySegments.THIGH,
  [MarkerIds.RLFC]: BodySegments.THIGH,
  [MarkerIds.LLFC]: BodySegments.THIGH,
  [MarkerIds.RMFC]: BodySegments.THIGH,
  [MarkerIds.LMFC]: BodySegments.THIGH,
  [MarkerIds.RKJC]: BodySegments.KNEE,
  [MarkerIds.LKJC]: BodySegments.KNEE,
  [MarkerIds.RSHA]: BodySegments.SHANK,
  [MarkerIds.LSHA]: BodySegments.SHANK,
  [MarkerIds.RTT]: BodySegments.SHANK,
  [MarkerIds.LTT]: BodySegments.SHANK
};

// Define the default skeleton model connections
export const defaultJoints: Joint[] = [
  // Head connections
  { startMarkerId: MarkerIds.LHEAD, endMarkerId: MarkerIds.RHEAD, length: 0, name: "Head Width" },
  { startMarkerId: MarkerIds.LHEAD, endMarkerId: MarkerIds.C7T1, length: 0, name: "Left Head to Neck" },
  { startMarkerId: MarkerIds.RHEAD, endMarkerId: MarkerIds.C7T1, length: 0, name: "Right Head to Neck" },

  // Shoulder connections
  { startMarkerId: MarkerIds.C7T1, endMarkerId: MarkerIds.LSAP, length: 0, name: "Neck to Left Shoulder" },
  { startMarkerId: MarkerIds.C7T1, endMarkerId: MarkerIds.RSAP, length: 0, name: "Neck to Right Shoulder" },

  // Arms
  { startMarkerId: MarkerIds.LSAP, endMarkerId: MarkerIds.LUM, length: 0, name: "Left Upper Arm" },
  { startMarkerId: MarkerIds.RSAP, endMarkerId: MarkerIds.RUM, length: 0, name: "Right Upper Arm" },
  { startMarkerId: MarkerIds.LUM, endMarkerId: MarkerIds.LRM, length: 0, name: "Left Elbow Width" },
  { startMarkerId: MarkerIds.RUM, endMarkerId: MarkerIds.RRM, length: 0, name: "Right Elbow Width" },
  { startMarkerId: MarkerIds.LUM, endMarkerId: MarkerIds.LUS, length: 0, name: "Left Forearm" },
  { startMarkerId: MarkerIds.RUM, endMarkerId: MarkerIds.RUS, length: 0, name: "Right Forearm" },

  // Torso
  { startMarkerId: MarkerIds.LSAP, endMarkerId: MarkerIds.LASI, length: 0, name: "Left Trunk" },
  { startMarkerId: MarkerIds.RSAP, endMarkerId: MarkerIds.RASI, length: 0, name: "Right Trunk" },

  // Pelvis
  { startMarkerId: MarkerIds.LASI, endMarkerId: MarkerIds.RASI, length: 0, name: "ASIS Width" },
  { startMarkerId: MarkerIds.LPSI, endMarkerId: MarkerIds.RPSI, length: 0, name: "PSIS Width" },
  { startMarkerId: MarkerIds.LASI, endMarkerId: MarkerIds.LPSI, length: 0, name: "Left Pelvis Length" },
  { startMarkerId: MarkerIds.RASI, endMarkerId: MarkerIds.RPSI, length: 0, name: "Right Pelvis Length" },

  // Hip
  { startMarkerId: MarkerIds.LASI, endMarkerId: MarkerIds.LHJC, length: 0, name: "Left Hip Joint" },
  { startMarkerId: MarkerIds.RASI, endMarkerId: MarkerIds.RHJC, length: 0, name: "Right Hip Joint" },
  { startMarkerId: MarkerIds.LHJC, endMarkerId: MarkerIds.LTRO, length: 0, name: "Left Hip to Trochanter" },
  { startMarkerId: MarkerIds.RHJC, endMarkerId: MarkerIds.RTRO, length: 0, name: "Right Hip to Trochanter" },

  // Thigh
  { startMarkerId: MarkerIds.LHJC, endMarkerId: MarkerIds.LTHI, length: 0, name: "Left Thigh Upper" },
  { startMarkerId: MarkerIds.RHJC, endMarkerId: MarkerIds.RTHI, length: 0, name: "Right Thigh Upper" },
  { startMarkerId: MarkerIds.LTHI, endMarkerId: MarkerIds.LKJC, length: 0, name: "Left Thigh Lower" },
  { startMarkerId: MarkerIds.RTHI, endMarkerId: MarkerIds.RKJC, length: 0, name: "Right Thigh Lower" },
  { startMarkerId: MarkerIds.LLFC, endMarkerId: MarkerIds.LMFC, length: 0, name: "Left Knee Width" },
  { startMarkerId: MarkerIds.RLFC, endMarkerId: MarkerIds.RMFC, length: 0, name: "Right Knee Width" },

  // Shank
  { startMarkerId: MarkerIds.LKJC, endMarkerId: MarkerIds.LSHA, length: 0, name: "Left Shank Upper" },
  { startMarkerId: MarkerIds.RKJC, endMarkerId: MarkerIds.RSHA, length: 0, name: "Right Shank Upper" },
  { startMarkerId: MarkerIds.LSHA, endMarkerId: MarkerIds.LTT, length: 0, name: "Left Shank Middle" },
  { startMarkerId: MarkerIds.RSHA, endMarkerId: MarkerIds.RTT, length: 0, name: "Right Shank Middle" },
  { startMarkerId: MarkerIds.LTT, endMarkerId: MarkerIds.LAJC, length: 0, name: "Left Shank Lower" },
  { startMarkerId: MarkerIds.RTT, endMarkerId: MarkerIds.RAJC, length: 0, name: "Right Shank Lower" },

  // Ankle
  { startMarkerId: MarkerIds.LAJC, endMarkerId: MarkerIds.LLMA, length: 0, name: "Left Ankle Lateral" },
  { startMarkerId: MarkerIds.RAJC, endMarkerId: MarkerIds.RLMA, length: 0, name: "Right Ankle Lateral" },
  { startMarkerId: MarkerIds.LAJC, endMarkerId: MarkerIds.LMMA, length: 0, name: "Left Ankle Medial" },
  { startMarkerId: MarkerIds.RAJC, endMarkerId: MarkerIds.RMMA, length: 0, name: "Right Ankle Medial" },

  // Foot
  { startMarkerId: MarkerIds.LMMA, endMarkerId: MarkerIds.LLMA, length: 0, name: "Left Ankle Width" },
  { startMarkerId: MarkerIds.RMMA, endMarkerId: MarkerIds.RLMA, length: 0, name: "Right Ankle Width" },
  { startMarkerId: MarkerIds.LAJC, endMarkerId: MarkerIds.LHEE, length: 0, name: "Left Foot Back" },
  { startMarkerId: MarkerIds.RAJC, endMarkerId: MarkerIds.RHEE, length: 0, name: "Right Foot Back" },
  { startMarkerId: MarkerIds.LHEE, endMarkerId: MarkerIds.LFOO, length: 0, name: "Left Foot Middle" },
  { startMarkerId: MarkerIds.RHEE, endMarkerId: MarkerIds.RFOO, length: 0, name: "Right Foot Middle" },
  { startMarkerId: MarkerIds.LFOO, endMarkerId: MarkerIds.LTOE, length: 0, name: "Left Foot Front" },
  { startMarkerId: MarkerIds.RFOO, endMarkerId: MarkerIds.RTOE, length: 0, name: "Right Foot Front" },
  { startMarkerId: MarkerIds.LTOE, endMarkerId: MarkerIds.LBTO, length: 0, name: "Left Foot Toe" },
  { startMarkerId: MarkerIds.RTOE, endMarkerId: MarkerIds.RBTO, length: 0, name: "Right Foot Toe" }
];
