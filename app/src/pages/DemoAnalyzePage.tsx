import React, { useState, useMemo } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button,
  Alert,
  StatusIndicator,
  ProgressBar,
  FormField,
  FileUpload
} from '@cloudscape-design/components';

import ImageViewer3D from '../components/ImageViewer3D';
import { mockPredictions, type Prediction } from './mockPredictions';

// Mock analysis states
type AnalysisStatus = 'idle' | 'processing' | 'completed' | 'failed';

interface MockAnalysis {
  id: string;
  status: AnalysisStatus;
  current_window: number;
  total_windows: number;
  image_width: number;
  image_height: number;
  predictions: Prediction[];
}

const DemoAnalyzePage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mockAnalysis, setMockAnalysis] = useState<MockAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (!mockAnalysis) return 0;
    if (mockAnalysis.status === 'completed') return 100;
    if (mockAnalysis.status === 'failed') return 0;
    if (mockAnalysis.total_windows === 0) return 50;
    
    return Math.round((mockAnalysis.current_window / mockAnalysis.total_windows) * 100);
  }, [mockAnalysis]);

  // Get current stage description
  const currentStage = useMemo(() => {
    if (!mockAnalysis) return 'Initializing...';

    switch (mockAnalysis.status) {
      case 'completed':
        return 'Demo analysis complete!';
      case 'failed':
        return 'Demo analysis failed';
      case 'processing':
        if (mockAnalysis.total_windows > 1) {
          return `Processing window ${mockAnalysis.current_window + 1} of ${mockAnalysis.total_windows}...`;
        }
        return 'Running demo AI detection...';
      default:
        return 'Initializing demo...';
    }
  }, [mockAnalysis]);

  const handleFileUpload = ({ detail }: any) => {
    const files = detail.value;
    setSelectedFiles(files);
    setError(null);
    setMockAnalysis(null);

    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const simulateAnalysis = async () => {
    if (selectedFiles.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    // Create mock analysis with realistic image dimensions
    const mockImageWidth = 7215; // Default dimensions for demo
    const mockImageHeight = 5412;
    const totalWindows = Math.ceil(mockImageWidth / 640) * Math.ceil(mockImageHeight / 640);

    const newMockAnalysis: MockAnalysis = {
      id: `demo-${Date.now()}`,
      status: 'processing',
      current_window: 0,
      total_windows: totalWindows,
      image_width: mockImageWidth,
      image_height: mockImageHeight,
      predictions: []
    };

    setMockAnalysis(newMockAnalysis);

    // Simulate progressive analysis
    for (let i = 0; i <= totalWindows; i++) {
      await new Promise(resolve => setTimeout(resolve, 3)); // 300ms delay per window
      
      setMockAnalysis(prev => {
        if (!prev) return null;
        return {
          ...prev,
          current_window: i,
          status: i === totalWindows ? 'completed' : 'processing',
          predictions: i === totalWindows ? mockPredictions : []
        };
      });
    }

    setIsAnalyzing(false);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setError('Please upload an image first');
      return;
    }

    try {
      await simulateAnalysis();
    } catch (err) {
      console.error('Demo analysis error:', err);
      setError('Demo analysis simulation failed');
      setIsAnalyzing(false);
      setMockAnalysis(null);
    }
  };

  const resetAnalysis = () => {
    setSelectedFiles([]);
    setError(null);
    setMockAnalysis(null);
    
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsAnalyzing(false);
  };

  const isComplete = mockAnalysis?.status === 'completed';
  const isFailed = mockAnalysis?.status === 'failed';

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="Demo page to test ImageViewer3D component with mock analysis results"
          actions={
            (selectedFiles.length > 0 || isComplete) && (
              <Button
                variant="normal"
                onClick={resetAnalysis}
                iconName="refresh"
              >
                Reset Demo
              </Button>
            )
          }
        >
          Demo Image Analysis
        </Header>

        {/* Error Alert */}
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Demo Info Alert */}
        <Alert type="info" header="Demo Mode">
          This is a demo page to test the ImageViewer3D component. 
          Upload an image and click analyze to see mock results without making backend requests.
        </Alert>

        {/* File Upload Section */}
        {!mockAnalysis && (
          <div>
            <Box variant="h2" margin={{ bottom: 'm' }}>
              Upload Image
            </Box>
            <SpaceBetween direction="vertical" size="m">
              <FormField
                label="Select H&E stained slide image"
                description="Supports PNG, JPG, JPEG, TIFF formats. This is a demo - no actual analysis will be performed."
              >
                <FileUpload
                  onChange={handleFileUpload}
                  value={selectedFiles}
                  i18nStrings={{
                    uploadButtonText: e => e ? "Choose files" : "Choose file",
                    dropzoneText: e => e ? "Drop files to upload" : "Drop file to upload",
                    removeFileAriaLabel: e => `Remove file ${e + 1}`,
                    limitShowFewer: "Show fewer files",
                    limitShowMore: "Show more files",
                    errorIconAriaLabel: "Error"
                  }}
                  showFileLastModified
                  showFileSize
                  showFileThumbnail
                  constraintText="Maximum file size: 100MB (Demo only)"
                  accept="image/*,.tiff,.tif"
                />
              </FormField>

              {/* Preview */}
              {previewUrl && selectedFiles.length > 0 && (
                <Box>
                  <Box variant="h3" margin={{ bottom: 's' }}>
                    Preview
                  </Box>
                  <div className="text-center p-4 bg-gray-50 rounded-lg border">
                    <img
                      src={previewUrl}
                      alt="Image preview"
                      className="max-w-full max-h-64 object-contain border border-gray-300 rounded"
                    />
                    <Box variant="small" margin={{ top: 's' }}>
                      {selectedFiles[0].name} ({Math.round(selectedFiles[0].size / 1024)} KB)
                    </Box>
                  </div>
                </Box>
              )}
            </SpaceBetween>
          </div>
        )}

        {/* Action Button */}
        {!mockAnalysis && selectedFiles.length > 0 && (
          <div className="text-center">
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={selectedFiles.length === 0 || isAnalyzing}
              loading={isAnalyzing}
              iconName="search"
            >
              Start Demo Analysis
            </Button>
          </div>
        )}

        {/* Analysis Progress Section */}
        {mockAnalysis && mockAnalysis.status === 'processing' && (
          <Alert type="info" header="Demo Analysis in Progress">
            <SpaceBetween direction="vertical" size="s">
              <ProgressBar
                value={progressPercentage}
                label="Demo analysis progress"
                description={currentStage}
              />
              <Box variant="small">
                This is a simulated analysis to test the ImageViewer3D component
              </Box>
            </SpaceBetween>
          </Alert>
        )}

        {/* Results Section */}
        {isComplete && mockAnalysis && (
          <Container header={
            <Header
              variant="h2"
              actions={
                <SpaceBetween direction="horizontal" size="s">
                  <Button
                    variant="normal"
                    onClick={resetAnalysis}
                    iconName="refresh"
                  >
                    Reset Demo
                  </Button>
                  <Button
                    variant="primary"
                    iconName="download"
                    disabled
                  >
                    Download Report (Demo)
                  </Button>
                </SpaceBetween>
              }
            >
              Demo Analysis Results
            </Header>
          }>
            <SpaceBetween direction="vertical" size="m">
              <Box margin={{ bottom: 's' }}>
                <StatusIndicator type="success">
                  Demo analysis completed successfully
                </StatusIndicator>
              </Box>
              
              <Box variant="h3" margin={{ bottom: 's' }}>
                3D Visualization with Mock Detections
              </Box>
              
              <Alert type="info" header="ImageViewer3D Test">
                The component below shows the 3D visualization of the analysis results with mock detection data.
                You can interact with the 3D view using mouse controls.
              </Alert>
              
              <div className="bg-gray-50 rounded-lg p-4 relative">
                <ImageViewer3D
                  imageSrc={previewUrl || ''}
                  predictions={mockAnalysis.predictions}
                  imageWidth={mockAnalysis.image_width}
                  imageHeight={mockAnalysis.image_height}
                  currentWindow={mockAnalysis.current_window}
                />
              </div>

              {/* Detection Summary */}
              <Box variant="h3" margin={{ bottom: 's' }}>
                Detection Summary
              </Box>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600">
                    {mockAnalysis.predictions.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Detections</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-green-600">
                    {mockAnalysis.total_windows}
                  </div>
                  <div className="text-sm text-gray-600">Windows Processed</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border">
                  <div className="text-2xl font-bold text-purple-600">
                    {(mockAnalysis.predictions.reduce((sum, p) => sum + p.confidence, 0) / mockAnalysis.predictions.length * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Avg. Confidence</div>
                </div>
              </div>
            </SpaceBetween>
          </Container>
        )}

        {/* Failure Section */}
        {isFailed && (
          <Alert type="error" header="Demo Analysis Failed">
            This is a simulated failure for testing purposes.
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default DemoAnalyzePage;
