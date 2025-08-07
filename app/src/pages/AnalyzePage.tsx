import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button,
  FormField,
  FileUpload,
  ProgressBar,
  Alert,
  Cards,
  StatusIndicator,
  ColumnLayout
} from '@cloudscape-design/components';
import type { AnalysisResult, TestImage, AnalysisHistory } from '../types/analysis';
import ImageViewer from '../components/ImageViewer';
import { useAnalysisProgress } from '../hooks/useAnalysisProgress';
import { authenticatedFetchJson } from '../lib/api';

const AnalyzePage: React.FC = () => {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [testImages, setTestImages] = useState<TestImage[]>([]);
  const [selectedTestImage, setSelectedTestImage] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  // Real-time progress tracking
  const { 
    progress, 
    progressPercentage, 
    currentStage, 
    isComplete, 
    isFailed 
  } = useAnalysisProgress(currentAnalysisId || '');

  // Watch for analysis completion
  useEffect(() => {
    if (isComplete && progress) {
      // Convert Supabase analysis to AnalysisResult format
      const predictions = progress.analysis_detections?.map(detection => ({
        bbox: [detection.bbox_x1, detection.bbox_y1, detection.bbox_x2, detection.bbox_y2] as [number, number, number, number],
        confidence: detection.confidence,
        class_id: detection.class_id,
        class_name: detection.class_name
      })) || [];

      const result: AnalysisResult = {
        predictions,
        image_width: progress.user_images?.image_width || 0,
        image_height: progress.user_images?.image_height || 0,
        total_detections: progress.total_detections,
        processing_info: {
          original_size: `${progress.user_images?.image_width || 0}x${progress.user_images?.image_height || 0}`,
          original_format: progress.user_images?.file_format || '',
          method: progress.processing_method,
          window_size: progress.window_size || 'direct',
          source: progress.source_type === 'uploaded' ? 's3' : 'test_image'
        }
      };

      setAnalysisResult(result);
      setShowResults(true);
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentAnalysisId(null);

      // Save to localStorage for compatibility
      if (user) {
        const analysis: AnalysisHistory = {
          id: progress.id,
          userId: user.id,
          imageName: progress.image_name,
          imageSize: progress.user_images?.file_size || 0,
          analysisDate: new Date(progress.analysis_date),
          result,
          processingTime: progress.processing_time || 0,
          status: 'completed',
          isTestImage: progress.source_type === 'test_image',
          testImageName: progress.source_type === 'test_image' ? selectedTestImage || undefined : undefined
        };

        const existingHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        existingHistory.push(analysis);
        localStorage.setItem('analysisHistory', JSON.stringify(existingHistory));
      }
    }
  }, [isComplete, progress, user, selectedTestImage]);

  // Handle analysis failure
  useEffect(() => {
    if (isFailed && progress) {
      setError(progress.error_message || 'Analysis failed');
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentAnalysisId(null);
    }
  }, [isFailed, progress]);

  // Load test images on component mount
  useEffect(() => {
    const loadTestImages = async () => {
      try {
        const response = await fetch('/test-images');
        if (response.ok) {
          const data = await response.json();
          console.log(data);
          setTestImages(data.test_images);
        }
      } catch (error) {
        console.error('Failed to load test images:', error);
      }
    };
    
    loadTestImages();
  }, []);

  const handleFileUpload = ({ detail }: any) => {
    const files = detail.value;
    setSelectedFiles(files);
    setSelectedTestImage(null);
    setError(null);
    setAnalysisResult(null);
    setShowResults(false);
    setCurrentAnalysisId(null);
    
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleTestImageSelect = (testImageName: string) => {
    setSelectedTestImage(testImageName);
    setSelectedFiles([]);
    setError(null);
    setAnalysisResult(null);
    setShowResults(false);
    setCurrentAnalysisId(null);
    
    const testImage = testImages.find(img => img.name === testImageName);
    if (testImage) {
      setPreviewUrl(testImage.url);
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && !selectedTestImage) {
      setError('Please select an image or test image first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentAnalysisId(null);

    try {
      // If test image is selected
      if (selectedTestImage) {
        console.log('Analyzing test image:', selectedTestImage);
        
        const result = await authenticatedFetchJson<AnalysisResult>('/analyze-test-image', {
          method: 'POST',
          body: {
            test_image_name: selectedTestImage
          }
        });
        
        setAnalysisResult(result);
        setShowResults(true);
        setIsLoading(false);
        
        console.log('Test image analysis completed successfully');
        return;
      }

      // If file is selected
      if (selectedFiles.length > 0) {
        const selectedFile = selectedFiles[0];
        setIsUploading(true);
        setUploadProgress(0);

        // Step 1: Get presigned URL
        setUploadProgress(5);
        console.log('Getting presigned URL...');
        
        const { presigned_url, s3_key } = await authenticatedFetchJson<{ presigned_url: string; s3_key: string }>('/generate-presigned-url', {
          method: 'POST',
          body: {
            filename: selectedFile.name,
            content_type: selectedFile.type || 'image/jpeg'
          }
        });
        
        setUploadProgress(10);

        // Step 2: Upload to S3
        console.log('Uploading to S3...');
        
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = 10 + ((e.loaded / e.total) * 60);
              setUploadProgress(Math.round(percentComplete));
            }
          });

          xhr.upload.addEventListener('load', () => {
            setUploadProgress(70);
            console.log('S3 upload completed');
          });

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('S3 upload network error'));
          });

          xhr.addEventListener('timeout', () => {
            reject(new Error('S3 upload timeout'));
          });

          xhr.open('PUT', presigned_url);
          xhr.setRequestHeader('Content-Type', selectedFile.type || 'image/jpeg');
          xhr.timeout = 300000;
          xhr.send(selectedFile);
        });

        setIsUploading(false);
        setUploadProgress(75);

        // Step 3: Request analysis
        console.log('Requesting analysis...');
        
        const result = await authenticatedFetchJson('/analyze-s3', {
          method: 'POST',
          body: {
            s3_key: s3_key
          }
        });
        
        // If we got an analysis_id, start real-time tracking
        if (result.analysis_id) {
          setCurrentAnalysisId(result.analysis_id);
          setUploadProgress(100);
          // Real-time tracking will handle the rest
        } else {
          // Fallback to immediate result
          setAnalysisResult(result);
          setShowResults(true);
          setIsLoading(false);
        }
        
        console.log('Analysis started successfully');
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentAnalysisId(null);
    }
  };

  const resetAnalysis = () => {
    setSelectedFiles([]);
    setSelectedTestImage(null);
    setAnalysisResult(null);
    setError(null);
    setShowResults(false);
    setCurrentAnalysisId(null);
    
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    
    setUploadProgress(0);
    setIsUploading(false);
    setIsLoading(false);
  };

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="Upload H&E stained slide images for AI-powered mitotic figure detection"
          actions={
            (selectedFiles.length > 0 || selectedTestImage || analysisResult) && (
              <Button
                variant="normal"
                onClick={resetAnalysis}
                iconName="refresh"
              >
                New Analysis
              </Button>
            )
          }
        >
          Image Analysis
        </Header>

        {/* Error Alert */}
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Upload Section */}
        {!showResults && (
          <ColumnLayout columns={2}>
            {/* File Upload */}
            <div>
              <Box variant="h2" margin={{ bottom: 'm' }}>
                Upload Image
              </Box>
              <SpaceBetween direction="vertical" size="m">
                <FormField
                  label="Select H&E stained slide image"
                  description="Supports PNG, JPG, JPEG, TIFF formats. Automatic scaling for large images."
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
                    constraintText="Maximum file size: 100MB"
                    accept="image/*,.tiff,.tif"
                  />
                </FormField>

                {previewUrl && selectedFiles.length > 0 && (
                  <Box>
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <img 
                        src={previewUrl} 
                        alt="Image preview" 
                        className="max-w-full max-h-64 object-contain border border-gray-300 rounded"
                      />
                    </div>
                  </Box>
                )}
              </SpaceBetween>
            </div>

            {/* Test Images */}
            <div>
              <Box variant="h2" margin={{ bottom: 'm' }}>
                Sample Images
              </Box>
              {testImages.length > 0 ? (
                <Cards
                  ariaLabels={{
                    itemSelectionLabel: (_, t) => `select ${t.name}`,
                    selectionGroupLabel: "Item selection"
                  }}
                  cardDefinition={{
                    header: item => item.name,
                    sections: []
                  }}
                  cardsPerRow={[
                    { cards: 1 },
                    { minWidth: 500, cards: 2 }
                  ]}
                  items={testImages}
                  loadingText="Loading test images"
                  empty={
                    <Box textAlign="center" color="inherit">
                      <Box variant="strong" textAlign="center" color="inherit">
                        No test images available
                      </Box>
                    </Box>
                  }
                  selectionType="single"
                  selectedItems={selectedTestImage ? testImages.filter(img => img.name === selectedTestImage) : []}
                  onSelectionChange={({ detail }) => {
                    if (detail.selectedItems.length > 0) {
                      handleTestImageSelect(detail.selectedItems[0].name);
                    } else {
                      setSelectedTestImage(null);
                      setPreviewUrl(null);
                    }
                  }}
                />
              ) : (
                <Box textAlign="center" color="inherit">
                  <Box variant="p" textAlign="center" color="inherit">
                    No sample images available
                  </Box>
                </Box>
              )}
            </div>
          </ColumnLayout>
        )}

        {/* Progress Section */}
        {(isUploading || (uploadProgress > 0 && isLoading) || currentAnalysisId) && (
          <Alert type="info" header={
            isUploading ? 'Uploading Image...' : 
            currentAnalysisId ? 'AI Analysis in Progress...' : 
            'Processing Image...'
          }>
            <SpaceBetween direction="vertical" size="s">
              <ProgressBar
                value={
                  isUploading ? uploadProgress : 
                  currentAnalysisId ? progressPercentage : 
                  100
                }
                label={
                  isUploading ? 'Upload progress' : 
                  currentAnalysisId ? 'AI Analysis progress' : 
                  'AI Analysis in progress'
                }
                description={
                  isUploading 
                    ? `${uploadProgress}% uploaded`
                    : currentAnalysisId 
                    ? currentStage
                    : 'AI model is analyzing mitotic figures...'
                }
              />
              <Box variant="small">
                {isUploading ? (
                  uploadProgress < 10 
                    ? 'Preparing secure upload...'
                    : uploadProgress < 70 
                    ? 'Uploading to cloud storage...'
                    : 'Upload completed, processing...'
                ) : currentAnalysisId ? (
                  <SpaceBetween direction="vertical" size="xs">
                    <div>{currentStage}</div>
                    {progress?.processing_progress && 
                     typeof progress.processing_progress === 'object' && 
                     'total_windows' in progress.processing_progress && 
                     'current_window' in progress.processing_progress && 
                     (progress.processing_progress as any).total_windows > 1 && (
                      <div className="text-xs text-gray-500">
                        Window {((progress.processing_progress as any).current_window || 0) + 1} of {(progress.processing_progress as any).total_windows}
                      </div>
                    )}
                  </SpaceBetween>
                ) : (
                  'Deep learning analysis in progress. This may take a few moments.'
                )}
              </Box>
            </SpaceBetween>
          </Alert>
        )}

        {/* Action Button */}
        {!showResults && (
          <div className="text-center">
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={(selectedFiles.length === 0 && !selectedTestImage) || isLoading || isUploading}
              loading={isLoading || isUploading}
              iconName="search"
            >
              {isUploading ? 'Uploading...' : isLoading ? 'Analyzing...' : 'Start AI Analysis'}
            </Button>
          </div>
        )}

        {/* Results Section */}
        {showResults && analysisResult && (
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
                    New Analysis
                  </Button>
                  <Button
                    variant="primary"
                    iconName="download"
                  >
                    Download Report
                  </Button>
                </SpaceBetween>
              }
            >
              Analysis Results
            </Header>
          }>
            <ColumnLayout columns={2} variant="text-grid">
              {/* Image with detections */}
              <div>
                <Box variant="h3" margin={{ bottom: 's' }}>
                  Analyzed Image with Detections
                </Box>
                <Box margin={{ bottom: 's' }}>
                  <StatusIndicator type="success">
                    Analysis completed successfully
                  </StatusIndicator>
                </Box>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ImageViewer 
                    imageSrc={
                      progress?.image_url || 
                      (selectedTestImage 
                        ? `/test-image/${selectedTestImage}` 
                        : previewUrl || analysisResult.image || '')
                    } 
                    predictions={analysisResult.predictions}
                    imageWidth={analysisResult.image_width}
                    imageHeight={analysisResult.image_height}
                  />
                </div>
              </div>

              {/* Statistics */}
              <div>
                <SpaceBetween direction="vertical" size="m">
                  <Box variant="h3">
                    Detection Summary
                  </Box>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        {analysisResult.total_detections}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        Mitotic Figures Detected
                      </div>
                    </div>
                  </div>

                  <ColumnLayout columns={2}>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-semibold text-gray-900">
                        {analysisResult.image_width} × {analysisResult.image_height}
                      </div>
                      <div className="text-xs text-gray-500">Image Resolution</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-semibold text-gray-900">
                        {analysisResult.processing_info?.method === 'sliding_window' ? 'Sliding Window' : 'Direct'}
                      </div>
                      <div className="text-xs text-gray-500">Processing Method</div>
                    </div>
                  </ColumnLayout>

                  {analysisResult.processing_info?.method === 'sliding_window' && (
                    <Alert type="info" header="Large Image Processing">
                      This image was processed using sliding window technique with 640×640 patches for optimal detection accuracy.
                    </Alert>
                  )}

                  <Alert type="warning" header="Clinical Research Tool">
                    This tool is intended for research purposes only and should not be used for clinical diagnosis without pathologist review.
                  </Alert>
                </SpaceBetween>
              </div>
            </ColumnLayout>
          </Container>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default AnalyzePage; 