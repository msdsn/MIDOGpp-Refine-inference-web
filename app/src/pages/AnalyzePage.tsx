import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAnalyses } from '../contexts/AnalysesContext';
import { useDetections } from '../contexts/DetectionsContext';
import { useImages } from '../contexts/ImagesContext';
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


// TestImage interface removed - using database images directly
//import ImageViewer3D from '../components/ImageViewer3D';
import ImageViewer from '../components/ImageViewer';
import { authenticatedFetchJson } from '../lib/api';

import { v4 as uuidv4 } from 'uuid';

const AnalyzePage: React.FC = () => {
  const { user } = useAuth();
  const { analyses } = useAnalyses();
  const { detectionsByAnalysis } = useDetections();
  const { images } = useImages();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const downloadImageRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log('analyses', analyses);
  }, [analyses]);
  useEffect(() => {
    console.log('detectionsByAnalysis', detectionsByAnalysis);
  }, [detectionsByAnalysis]);
  useEffect(() => {
    console.log('images', images);
  }, [images]);

  // Get current analysis from context
  const currentAnalysis = useMemo(() => {
    if (!currentAnalysisId) return null;
    console.log('currentAnalysisIdxx', currentAnalysisId);
    console.log('currentAnalysis', analyses.find(a => a.id === currentAnalysisId));
    return analyses.find(a => a.id === currentAnalysisId) || null;
  }, [analyses, currentAnalysisId]);

  // Get current analysis detections
  const currentDetections = useMemo(() => {
    if (!currentAnalysisId) return [];
    console.log('currentDetections', detectionsByAnalysis[currentAnalysisId]);
    return detectionsByAnalysis[currentAnalysisId] || [];
  }, [detectionsByAnalysis, currentAnalysisId]);

  // Get current analysis image
  const currentImage = useMemo(() => {
    if (!currentImageId) return null;
    console.log('currentImage', images.find(img => img.id === currentImageId));
    return images.find(img => img.id === currentImageId) || null;
  }, [images, currentImageId]);

  // Get test images from context
  const testImages = useMemo(() => {
    return images.filter(img => img.is_test_image);
  }, [images]);

  // Selected image is handled via selectedImageId state

  // Calculate progress from context data
  const progressPercentage = useMemo(() => {
    if (!currentAnalysis) return 0;
    if (currentAnalysis.status === 'completed') return 100;
    if (currentAnalysis.status === 'failed') return 0;

    // Calculate based on current_window / total_windows
    if (currentAnalysis.total_windows > 0) {
      return Math.round((currentAnalysis.current_window / currentAnalysis.total_windows) * 100);
    }

    return 50; // Processing
  }, [currentAnalysis]);

  // Get current stage description
  const currentStage = useMemo(() => {
    if (!currentAnalysis) return 'Initializing...';

    switch (currentAnalysis.status) {
      case 'completed':
        return 'Analysis complete!';
      case 'failed':
        return 'Analysis failed';
      case 'processing':
        if (currentAnalysis.total_windows > 1) {
          return `Analyzing window ${currentAnalysis.current_window + 1} of ${currentAnalysis.total_windows}...`;
        }
        return 'Running AI detection...';
      default:
        return 'Initializing...';
    }
  }, [currentAnalysis]);

  
  const isComplete = currentAnalysis?.status === 'completed';
  const isFailed = currentAnalysis?.status === 'failed';

  // Watch for analysis completion
  useEffect(() => {
    if (isComplete && currentAnalysis) {
      setIsUploading(false);
      setUploadProgress(0);
      console.log('Analysis completed!', currentAnalysis.id);
      
      // Scroll to top when analysis is complete and results are shown
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [isComplete, currentAnalysis]);

  // Handle analysis failure
  useEffect(() => {
    if (isFailed && currentAnalysis) {
      setError(currentAnalysis.error_message || 'Analysis failed');
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentAnalysisId(null);
    }
  }, [isFailed, currentAnalysis]);

  // Test images are now loaded from ImagesContext

  const handleFileUpload = ({ detail }: any) => {
    const files = detail.value;
    setSelectedFiles(files);
    setSelectedImageId(null);
    setError(null);
    setCurrentAnalysisId(null);

    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleImageSelect = async (imageId: string) => {
    console.log('handleImageSelect', imageId);
    setSelectedImageId(imageId);
    setSelectedFiles([]);
    setError(null);
    setCurrentAnalysisId(null);

    const image = images.find(img => img.id === imageId);
    if (image && image.is_test_image) {
      // For test images, construct URL from s3_key
      console.log('image', image);
      const filename = image.s3_key?.split('/').pop() || '';
      const result = await fetch(`/test-images/${filename}`);
      const data = await result.json();
      console.log('data', data);
      console.log('data.presigned_url', data.presigned_url);
      setPreviewUrl(data.presigned_url);
      //setPreviewUrl(`/image/${filename}`);
    } else if (image?.s3_url) {
      setPreviewUrl(image.s3_url);
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && !selectedImageId) {
      setError('Please select an image first');
      return;
    }

    const analysisId = uuidv4();
    setCurrentAnalysisId(analysisId);

    setError(null);

    try {
      // If test image is selected
      if (selectedImageId) {
        const selectedImg = images.find(img => img.id === selectedImageId);
        if (selectedImg?.is_test_image) {
          console.log('Analyzing test image:', selectedImg.id);

          setCurrentImageId(selectedImg.id);

          await authenticatedFetchJson('/analyze', {
            method: 'POST',
            body: {
              analysis_id: analysisId,
              model_name: 'mitotic-figure-detection',
              image_id: selectedImg.id,
              s3_key: selectedImg.s3_key,
              is_test_image: true
            }
          });
          return;
        }
      }

      const imageId = uuidv4();
      setCurrentImageId(imageId);

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
              const percentComplete = 10 + ((e.loaded / e.total) * 80);
              setUploadProgress(Math.round(percentComplete));
            }
          });

          xhr.upload.addEventListener('load', () => {
            setUploadProgress(95);
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
        setUploadProgress(100);

        // Step 3: Request analysis
        console.log('Requesting analysis...');

        const result = await authenticatedFetchJson('/analyze', {
          method: 'POST',
          body: {
            analysis_id: analysisId,
            model_name: 'mitotic-figure-detection',
            image_id: imageId,
            s3_key: s3_key,
            is_test_image: false
          }
        });

        // The new /analyze endpoint returns a simple completion status
        // Real analysis tracking happens via database
        if (result.completed) {

          // Wait a moment for the database to update, then find the most recent analysis
          setTimeout(() => {
            const mostRecentAnalysis = analyses
              .filter(a => a.profile_id === user?.id)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

            if (mostRecentAnalysis) {
              //setCurrentAnalysisId(mostRecentAnalysis.id);
              console.log('Found new analysis:', mostRecentAnalysis.id);
            } else {
              // If no analysis found yet, keep checking

            }
          }, 1000);

          console.log('Analysis started, tracking via context...');
        } else {
          setError('Analysis failed to complete');
        }

        console.log('Analysis started successfully');
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentAnalysisId(null);
    }
  };

  const resetAnalysis = () => {
    setSelectedFiles([]);
    setSelectedImageId(null);
    setError(null);
    setCurrentAnalysisId(null);

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);

    setUploadProgress(0);
    setIsUploading(false);
  };

  // Handle download report
  const handleDownloadReport = () => {
    console.log('handleDownloadReport');
    if (downloadImageRef.current) {
      console.log('downloadImageRef.current', downloadImageRef.current);
      downloadImageRef.current();
    }
  };

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="Upload H&E stained slide images for AI-powered mitotic figure detection"
          actions={
            (isComplete) && (
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
        {(currentAnalysisId === null || isUploading) && (
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
                    itemSelectionLabel: (_, t) => `select ${t.s3_key?.split('/').pop() || t.id}`,
                    selectionGroupLabel: "Item selection"
                  }}
                  cardDefinition={{
                    header: item => item.s3_key?.split('/').pop() || `Image ${item.id.slice(0, 8)}`,
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
                  selectedItems={selectedImageId ? testImages.filter(img => img.id === selectedImageId) : []}
                  onSelectionChange={({ detail }) => {
                    if (detail.selectedItems.length > 0) {
                      handleImageSelect(detail.selectedItems[0].id);
                    } else {
                      setSelectedImageId(null);
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

        {/* Upload Progress Section */}
        {(isUploading) && (
          <Alert type="info" header={
            'Uploading Image...'
          }>
            <SpaceBetween direction="vertical" size="s">
              <ProgressBar
                value={
                  uploadProgress
                }
                label={
                  'Upload progress'
                }
                description={
                  `${uploadProgress}% uploaded`
                }
              />
              <Box variant="small">
                {(
                  uploadProgress < 10
                    ? 'Preparing secure upload...'
                    : uploadProgress < 70
                      ? 'Uploading to cloud storage...'
                      : 'Upload completed, processing...'
                )}
              </Box>
            </SpaceBetween>
          </Alert>
        )}

        {/* Action Button */}
        {(currentAnalysisId === null || isUploading) && (
          <div className="text-center">
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={(selectedFiles.length === 0 && !selectedImageId) || isUploading}
              loading={isUploading}
              iconName="search"
            >
              {isUploading ? 'Uploading...' : 'Start AI Analysis'}
            </Button>
          </div>
        )}

        {
          currentAnalysisId !== null && !isUploading && !currentAnalysis && (
            <ProgressBar
              value={
                0
              }
              label={
                'Analysis progress'
              }
              description={
                'waiting for analysis to start...'
              }
            />
          )
        }

        {/* Analysis Progress Section */}
        {
          currentAnalysis && currentAnalysis.status === 'processing' && (
            <ProgressBar
              value={
                progressPercentage
              }
              label={
                'Analysis progress'
              }
              description={
                currentStage
              }
            />
          )
        }
        {/* Results Section */}
        {isComplete && currentImage && (
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
                    onClick={handleDownloadReport}
                  >
                    Download Report
                  </Button>
                </SpaceBetween>
              }
            >
              Analysis Results
            </Header>
          }>
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
              <div className="bg-gray-50 rounded-lg p-4 relative">
                <ImageViewer
                  imageSrc={
                    (previewUrl || '')
                  }
                  predictions={currentDetections.map(detection => ({
                    bbox: [detection.bbox_x1, detection.bbox_y1, detection.bbox_x2, detection.bbox_y2] as [number, number, number, number],
                    confidence: detection.confidence,
                    class_id: detection.class_id
                  }))}
                  imageWidth={currentImage.image_width || 0}
                  imageHeight={currentImage.image_height || 0}
                  onDownloadImage={downloadImageRef}
                  //currentWindow={currentAnalysis.current_window}
                />
              </div>
            </div>
          </Container>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default AnalyzePage; 