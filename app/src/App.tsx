import React, { useState, useRef } from 'react';

interface Prediction {
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

interface ProcessingInfo {
  original_size: string;
  original_format?: string;
  method: string;
  window_size: string;
}

interface AnalysisResult {
  predictions: Prediction[];
  image: string;
  image_width: number;
  image_height: number;
  total_detections: number;
  processing_info?: ProcessingInfo;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setAnalysisResult(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL from backend
      setUploadProgress(5);
      console.log('Getting presigned URL...');
      
      const presignedResponse = await fetch('/generate-presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          content_type: selectedFile.type || 'image/jpeg'
        })
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.detail || 'Failed to get upload URL');
      }

      const { presigned_url, s3_key } = await presignedResponse.json();
      setUploadProgress(10);

      // Step 2: Upload directly to S3 using presigned URL
      console.log('Uploading to S3...');
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            // Map upload progress to 10-70% range
            const percentComplete = 10 + ((e.loaded / e.total) * 60);
            setUploadProgress(Math.round(percentComplete));
          }
        });

        // Handle upload completion
        xhr.upload.addEventListener('load', () => {
          setUploadProgress(70);
          console.log('S3 upload completed');
        });

        // Handle response
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('S3 upload network error'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('S3 upload timeout'));
        });

        // Configure and send S3 upload request
        xhr.open('PUT', presigned_url);
        xhr.setRequestHeader('Content-Type', selectedFile.type || 'image/jpeg');
        xhr.timeout = 300000; // 5 minutes timeout
        xhr.send(selectedFile);
      });

      setIsUploading(false);
      setUploadProgress(75);

      // Step 3: Request analysis from backend using S3 key
      console.log('Requesting analysis...');
      
      const analysisResponse = await fetch('/analyze-s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          s3_key: s3_key
        })
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }

      const result: AnalysisResult = await analysisResponse.json();
      setUploadProgress(100);
      setAnalysisResult(result);
      
      console.log('Analysis completed successfully');

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetAnalysis = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setError(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderImageWithBoundingBoxes = () => {
    if (!analysisResult) return null;

    return (
      <div className="relative inline-block">
        <img 
          src={analysisResult.image} 
          alt="Analyzed cancer cells"
          className="max-w-full h-auto border border-gray-300 rounded-lg"
        />
        
        {/* Render bounding boxes */}
        <svg 
          className="absolute top-0 left-0 w-full h-full"
          viewBox={`0 0 ${analysisResult.image_width} ${analysisResult.image_height}`}
          preserveAspectRatio="none"
        >
          {analysisResult.predictions.map((prediction, index) => {
            const [x1, y1, x2, y2] = prediction.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            
            return (
              <g key={index}>
                {/* Bounding box rectangle */}
                <rect
                  x={x1}
                  y={y1}
                  width={width}
                  height={height}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3"
                  className="opacity-90"
                />
                
                {/* Label background */}
                <rect
                  x={x1}
                  y={y1 - 28}
                  width={Math.max(width, 120)}
                  height="28"
                  fill="#dc2626"
                  className="opacity-95"
                />
                
                {/* Label text */}
                <text
                  x={x1 + 6}
                  y={y1 - 8}
                  fill="white"
                  fontSize="13"
                  fontWeight="600"
                >
                  {`Mitotic Figure (${(prediction.confidence * 100).toFixed(1)}%)`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AI-Powered Mitotic Figure Detection
              </h1>
              <p className="text-gray-600 mt-1">
                Deep learning solution for cancer cell identification in H&E sections
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Clinical Research Tool</div>
              <div className="text-xs text-gray-400">Powered by YOLO AI Technology</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Time Savings</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Achieve up to <strong>60% time savings</strong> per slide with AI-assisted mitotic figure identification
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Enhanced Consistency</h3>
            </div>
            <p className="text-gray-600 text-sm">
              <strong>32.6% improvement</strong> in consistency between pathologists through standardized AI analysis
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Sliding Window Processing</h3>
            </div>
            <p className="text-gray-600 text-sm">
              <strong>Automatic scaling</strong> for large images using 640×640 window-based analysis
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Upload H&E Stained Slide Image
            </h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.tiff,.tif"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="text-lg font-medium text-gray-700 mb-2">
                  Click to upload slide image
                </span>
                <span className="text-sm text-gray-500">
                  Supports PNG, JPG, JPEG, TIFF formats • Automatic scaling for large images
                </span>
              </label>
            </div>
            
            {selectedFile && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-blue-800 font-medium">{selectedFile.name}</span>
                  <span className="text-blue-600 ml-2">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {(isUploading || (uploadProgress > 0 && isLoading)) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {isUploading ? 'Uploading Image...' : 'Processing Image...'}
              </h3>
              
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {isUploading ? 'Upload Progress' : 'Processing'}
                  </span>
                  <span className="text-sm font-medium text-blue-600">
                    {isUploading ? `${uploadProgress}%` : 'Running AI Analysis...'}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-300 ease-out ${
                      isUploading 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 animate-pulse'
                    }`}
                    style={{ 
                      width: isUploading ? `${uploadProgress}%` : '100%'
                    }}
                  ></div>
                </div>
                
                <div className="mt-4 text-sm text-gray-500">
                  {isUploading ? (
                    <>
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>
                          {uploadProgress < 10 
                            ? 'Preparing secure upload...' 
                            : uploadProgress < 70 
                            ? `Uploading to cloud storage... ${uploadProgress}%`
                            : 'Upload completed, processing...'
                          }
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {uploadProgress < 10 
                          ? 'Getting secure upload URL'
                          : uploadProgress < 70 
                          ? `${selectedFile?.name} • ${((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB`
                          : 'Image ready for AI analysis'
                        }
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>AI model is analyzing mitotic figures...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {previewUrl && !analysisResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Image Preview</h3>
            <div className="text-center">
              <div className="inline-block p-4 bg-gray-50 rounded-lg">
                <img 
                  src={previewUrl} 
                  alt="H&E slide preview" 
                  className="max-w-full max-h-96 object-contain border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || isLoading || isUploading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading Image...
              </>
            ) : isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing Slide...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Start AI Analysis
              </>
            )}
          </button>
          
          {(selectedFile || analysisResult) && (
            <button
              onClick={resetAnalysis}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Analysis
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-8">
            <div className="flex">
              <svg className="w-6 h-6 text-red-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">Analysis Error</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {analysisResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">Mitotic Figure Detection Results</h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {/* Image with Bounding Boxes */}
              <div className="xl:col-span-3">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Analyzed Slide with Detected Mitotic Figures
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Mitotic figures are highlighted with red bounding boxes and confidence scores
                  </p>
                </div>
                <div className="text-center bg-gray-50 rounded-lg p-6">
                  {renderImageWithBoundingBoxes()}
                </div>
              </div>

              {/* Statistics and Details */}
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Analysis Summary</h3>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {analysisResult.total_detections}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Mitotic Figures Detected</div>
                    </div>
                    
                    <div className="border-t border-blue-200 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Image Resolution:</span>
                        <span className="font-medium text-gray-800">
                          {analysisResult.image_width} × {analysisResult.image_height}
                        </span>
                      </div>
                      
                      {analysisResult.processing_info && (
                        <>
                          {analysisResult.processing_info.original_format && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Original Format:</span>
                              <span className="font-medium text-gray-800">
                                {analysisResult.processing_info.original_format}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Processing Method:</span>
                            <span className={`font-medium ${
                              analysisResult.processing_info.method === 'sliding_window' 
                                ? 'text-purple-600' 
                                : 'text-green-600'
                            }`}>
                              {analysisResult.processing_info.method === 'sliding_window' 
                                ? 'Sliding Window' 
                                : 'Direct Processing'}
                            </span>
                          </div>
                          
                          {analysisResult.processing_info.method === 'sliding_window' && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Window Size:</span>
                              <span className="font-medium text-gray-800">
                                {analysisResult.processing_info.window_size}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Processing Information */}
                {analysisResult.processing_info && analysisResult.processing_info.method === 'sliding_window' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h5 className="text-purple-800 font-medium text-sm">Large Image Processing</h5>
                        <p className="text-purple-700 text-xs mt-1">
                          This image was processed using sliding window technique with 640×640 patches and Non-Maximum Suppression to handle overlapping detections.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detection Details */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-800">Detection Details</h4>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {analysisResult.predictions.length === 0 ? (
                      <div className="p-6 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-gray-500 text-sm">No mitotic figures detected</div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4">
                        {analysisResult.predictions.map((prediction, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-gray-900">
                                Detection #{index + 1}
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                prediction.confidence >= 0.8 
                                  ? 'bg-green-100 text-green-800' 
                                  : prediction.confidence >= 0.6 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {(prediction.confidence * 100).toFixed(1)}%
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Class: <span className="font-medium">Mitotic Figure</span></div>
                              <div className="text-xs text-gray-500">
                                Position: ({prediction.bbox[0].toFixed(0)}, {prediction.bbox[1].toFixed(0)}) → 
                                ({prediction.bbox[2].toFixed(0)}, {prediction.bbox[3].toFixed(0)})
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Clinical Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h5 className="text-amber-800 font-medium text-sm">Clinical Research Tool</h5>
                      <p className="text-amber-700 text-xs mt-1">
                        This tool is intended for research purposes only and should not be used for clinical diagnosis without pathologist review.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>AI-Powered Mitotic Figure Detection • Deep Learning Technology for Pathology Research</p>
            <p className="mt-2">© 2024 Cancer Cell Analysis Platform. For research and educational purposes.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
