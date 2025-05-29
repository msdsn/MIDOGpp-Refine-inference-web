import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Prediction {
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

interface ImageViewerProps {
  imageSrc: string;
  predictions: Prediction[];
  imageWidth: number;
  imageHeight: number;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  imageSrc,
  predictions,
  imageWidth,
  imageHeight
}) => {
  const [scale, setScale] = useState(0.5);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  // Reset view when image changes
  useEffect(() => {
    setScale(0.5);
    setPosition({ x: 0, y: 0 });
    setSelectedPrediction(null);
  }, [imageSrc]);

  // Calculate minimap dimensions
  const minimapSize = 200;
  const minimapScale = Math.min(minimapSize / imageWidth, minimapSize / imageHeight);

  // Calculate viewport rectangle for minimap
  const getViewportRect = useCallback(() => {
    if (!containerRef.current) return { x: 0, y: 0, width: 0, height: 0 };
    
    const container = containerRef.current.getBoundingClientRect();
    const viewportWidth = container.width / scale;
    const viewportHeight = container.height / scale;
    const viewportX = -position.x / scale;
    const viewportY = -position.y / scale;
    
    return {
      x: Math.max(0, viewportX * minimapScale),
      y: Math.max(0, viewportY * minimapScale),
      width: Math.min(viewportWidth * minimapScale, minimapSize),
      height: Math.min(viewportHeight * minimapScale, minimapSize)
    };
  }, [scale, position, minimapScale]);

  // Handle minimap click to navigate
  const handleMinimapClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !minimapRef.current) return;
    
    const minimapRect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - minimapRect.left;
    const clickY = e.clientY - minimapRect.top;
    
    // Convert minimap coordinates to image coordinates
    const imageX = clickX / minimapScale;
    const imageY = clickY / minimapScale;
    
    // Center the viewport on the clicked point
    const container = containerRef.current.getBoundingClientRect();
    const newX = -(imageX * scale - container.width / 2);
    const newY = -(imageY * scale - container.height / 2);
    
    setPosition({ x: newX, y: newY });
  }, [minimapScale, scale]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.5, 8));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.5, 0.1));
  }, []);

  const resetView = useCallback(() => {
    setScale(0.5);
    setPosition({ x: 0, y: 0 });
    setSelectedPrediction(null);
  }, []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const scaleX = container.width / imageWidth;
    const scaleY = container.height / imageHeight;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(newScale);
    setPosition({ x: 0, y: 0 });
  }, [imageWidth, imageHeight]);

  // Focus on specific prediction
  const focusOnPrediction = useCallback((index: number) => {
    const prediction = predictions[index];
    if (!prediction || !containerRef.current) return;

    const [x1, y1, x2, y2] = prediction.bbox;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    
    // Calculate the scale needed to show the bounding box nicely

    const container = containerRef.current.getBoundingClientRect();
    
    const newScale = 0.5
    
    // Calculate position to center the bounding box
    const newX = -(centerX * newScale - container.width / 2);
    const newY = -(centerY * newScale - container.height / 2);
    
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    setSelectedPrediction(index);
  }, [predictions]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 8);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom towards mouse position
      const scaleChange = newScale / scale;
      const newX = position.x - (mouseX - position.x) * (scaleChange - 1);
      const newY = position.y - (mouseY - position.y) * (scaleChange - 1);
      
      setPosition({ x: newX, y: newY });
    }
    
    setScale(newScale);
  }, [scale, position]);

  // Add wheel event listener with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Mouse drag for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with input fields
      }
      
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetView();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          fitToScreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setShowMinimap(!showMinimap);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPosition(prev => ({ x: prev.x + 50, y: prev.y }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPosition(prev => ({ x: prev.x - 50, y: prev.y }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPosition(prev => ({ x: prev.x, y: prev.y + 50 }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPosition(prev => ({ x: prev.x, y: prev.y - 50 }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetView, fitToScreen, showMinimap]);

  // Pinch-to-zoom for touch devices
  const handleTouchZoom = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // Calculate distance between touches
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      // Store initial distance for comparison
      if (!containerRef.current?.dataset.initialPinchDistance) {
        containerRef.current!.dataset.initialPinchDistance = distance.toString();
        containerRef.current!.dataset.initialScale = scale.toString();
        return;
      }
      
      const initialDistance = parseFloat(containerRef.current.dataset.initialPinchDistance || '0');
      const initialScale = parseFloat(containerRef.current.dataset.initialScale || '1');
      const scaleChange = distance / initialDistance;
      const newScale = Math.min(Math.max(initialScale * scaleChange, 0.1), 8);
      
      // Calculate center point between touches
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = centerX - rect.left;
        const relativeY = centerY - rect.top;
        
        // Zoom towards center point
        const scaleRatio = newScale / scale;
        const newX = position.x - (relativeX - position.x) * (scaleRatio - 1);
        const newY = position.y - (relativeY - position.y) * (scaleRatio - 1);
        
        setPosition({ x: newX, y: newY });
      }
      
      setScale(newScale);
    }
  }, [scale, position]);

  const handleTouchZoomEnd = useCallback(() => {
    if (containerRef.current) {
      delete containerRef.current.dataset.initialPinchDistance;
      delete containerRef.current.dataset.initialScale;
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <button
            onClick={zoomIn}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Zoom In"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          
          <button
            onClick={zoomOut}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Zoom Out"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          
          <button
            onClick={fitToScreen}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Fit to Screen"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          
          <button
            onClick={resetView}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Reset View"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Zoom: {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              showMinimap 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}
            title="Toggle Minimap"
          >
            Minimap
          </button>
          
          <div className="text-sm text-gray-500">
            Mouse wheel to zoom • Drag to pan
          </div>
        </div>
      </div>

      {/* Prediction Navigation */}
      {predictions.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-blue-900">
              Detected Mitotic Figures ({predictions.length})
            </h4>
            {selectedPrediction !== null && (
              <span className="text-sm text-blue-600">
                Focused on Detection #{selectedPrediction + 1}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {predictions.map((prediction, index) => (
              <button
                key={index}
                onClick={() => focusOnPrediction(index)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPrediction === index
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                }`}
              >
                #{index + 1} ({(prediction.confidence * 100).toFixed(1)}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Container */}
      <div 
        ref={containerRef}
        className={`relative w-full h-[600px] bg-gray-100 rounded-lg overflow-hidden border border-gray-300 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          handleTouchStart(e);
          handleTouchZoom(e);
        }}
        onTouchMove={(e) => {
          handleTouchMove(e);
          handleTouchZoom(e);
        }}
        onTouchEnd={() => {
          handleTouchEnd();
          handleTouchZoomEnd();
        }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
          className="relative"
        >
          
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt="Analyzed cancer cells"
            className="block"
            draggable={false}
            style={{ 
              width: `${imageWidth}px`, 
              height: `${imageHeight}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              minWidth: 'none',
              minHeight: 'none'
            }}
          />
          
          {/* Bounding Boxes */}
          <svg 
            className="absolute top-0 left-0 pointer-events-none"
            width={imageWidth}
            height={imageHeight}
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="none"
          >
            {predictions.map((prediction, index) => {
              const [x1, y1, x2, y2] = prediction.bbox;
              const width = x2 - x1;
              const height = y2 - y1;
              const isSelected = selectedPrediction === index;
              
              return (
                <g key={index}>
                  {/* Bounding box rectangle */}
                  <rect
                    x={x1}
                    y={y1}
                    width={width}
                    height={height}
                    fill="none"
                    stroke={isSelected ? "#2563eb" : "#dc2626"}
                    strokeWidth={isSelected ? 4 : 3}
                    className={`opacity-90 ${isSelected ? 'animate-pulse' : ''}`}
                  />
                  
                  {/* Label background */}
                  <rect
                    x={x1}
                    y={y1 - 32}
                    width={Math.max(width, 140)}
                    height="32"
                    fill={isSelected ? "#2563eb" : "#dc2626"}
                    className="opacity-95"
                  />
                  
                  {/* Label text */}
                  <text
                    x={x1 + 6}
                    y={y1 - 10}
                    fill="white"
                    fontSize="14"
                    fontWeight="600"
                  >
                    {`#${index + 1} Mitotic (${(prediction.confidence * 100).toFixed(1)}%)`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        
        {/* Scale indicator */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm">
          Scale: {Math.round(scale * 100)}%
        </div>
        
        {/* Instructions */}
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-xs max-w-48">
          <div>• Mouse wheel: Zoom</div>
          <div>• Drag: Pan view</div>
          <div>• Click detection buttons to focus</div>
        </div>

        {/* Minimap */}
        {showMinimap && scale > 0.3 && (
          <div className="absolute top-4 right-4 bg-white border-2 border-gray-300 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-1 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Overview</span>
                <button
                  onClick={() => setShowMinimap(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close Minimap"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div 
              ref={minimapRef}
              className="relative cursor-pointer"
              onClick={handleMinimapClick}
              style={{
                width: minimapSize,
                height: minimapSize * (imageHeight / imageWidth)
              }}
            >
              {/* Minimap Image */}
              <img
                src={imageSrc}
                alt="Minimap"
                className="w-full h-full object-cover"
                draggable={false}
              />
              
              {/* Minimap Predictions */}
              <svg 
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                preserveAspectRatio="none"
              >
                {predictions.map((prediction, index) => {
                  const [x1, y1, x2, y2] = prediction.bbox;
                  const width = x2 - x1;
                  const height = y2 - y1;
                  const isSelected = selectedPrediction === index;
                  
                  return (
                    <rect
                      key={index}
                      x={x1}
                      y={y1}
                      width={width}
                      height={height}
                      fill="none"
                      stroke={isSelected ? "#2563eb" : "#dc2626"}
                      strokeWidth="2"
                      className="opacity-80"
                    />
                  );
                })}
              </svg>
              
              {/* Viewport Indicator */}
              {(() => {
                const viewportRect = getViewportRect();
                return (
                  <div
                    className="absolute border-2 border-yellow-400 bg-yellow-200 bg-opacity-30"
                    style={{
                      left: viewportRect.x,
                      top: viewportRect.y,
                      width: viewportRect.width,
                      height: viewportRect.height,
                      pointerEvents: 'none'
                    }}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer; 