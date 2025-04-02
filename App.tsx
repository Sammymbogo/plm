import { useState } from 'react';
import DataInputView from './components/DataInputView';
import SkeletonVisualizationView from './components/SkeletonVisualizationView';
import AnalysisView from './components/AnalysisView';

const App = () => {
  const [activeTab, setActiveTab] = useState<'data' | 'visualization' | 'analysis'>('data');
  const [skeletonData, setSkeletonData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Custom Skeleton Tracking System</h1>
        <p className="text-sm">Markerless and Marker-based Motion Capture</p>
      </header>

      <nav className="bg-white p-4 shadow-sm">
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 rounded ${activeTab === 'data' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTab('data')}
          >
            Data Input
          </button>
          <button
            className={`px-4 py-2 rounded ${activeTab === 'visualization' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTab('visualization')}
            disabled={!skeletonData}
          >
            Skeleton Visualization
          </button>
          <button
            className={`px-4 py-2 rounded ${activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTab('analysis')}
            disabled={!skeletonData}
          >
            Analysis
          </button>
        </div>
      </nav>

      <main className="container mx-auto p-4">
        {activeTab === 'data' && <DataInputView onDataLoaded={setSkeletonData} />}
        {activeTab === 'visualization' && <SkeletonVisualizationView skeletonData={skeletonData} />}
        {activeTab === 'analysis' && <AnalysisView skeletonData={skeletonData} />}
      </main>
    </div>
  );
};

export default App;
