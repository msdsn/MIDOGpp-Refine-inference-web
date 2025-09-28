import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { MapControls, Text, Html } from '@react-three/drei';
import { TextureLoader, PlaneGeometry, Mesh } from 'three';
import * as THREE from 'three';

const GAP_SIZE = 64; // Visual padding between windows (10%)
const WINDOW_SIZE = 640;

interface Detection {
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
}

interface WindowInfo {
  windowIndex: number;
  x: number;
  y: number;
  detections: Detection[];
}

interface ImageViewer3DProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  predictions?: Detection[];
  currentWindow?: number;
  totalWindows?: number;
}

// Individual window plane component
const WindowPlane: React.FC<{
  imageWidth: number;
  imageHeight: number;
  currentWindow: number;
  windowInfo: WindowInfo;
  imageSrc: string;
  scale: number;
}> = ({ windowInfo, imageSrc, currentWindow, imageWidth, imageHeight, scale }) => {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const isProcessed = windowInfo.windowIndex < currentWindow;
  
  // Calculate actual window dimensions (may be smaller than WINDOW_SIZE at edges)
  const actualWindowWidth = Math.min(WINDOW_SIZE, imageWidth - windowInfo.x);
  const actualWindowHeight = Math.min(WINDOW_SIZE, imageHeight - windowInfo.y);

  // Calculate world position with visual gap for better presentation
  const visualX = windowInfo.x + (Math.floor(windowInfo.x / WINDOW_SIZE) * GAP_SIZE);
  const visualY = windowInfo.y + (Math.floor(windowInfo.y / WINDOW_SIZE) * GAP_SIZE);

  const worldX = (visualX + actualWindowWidth / 2 - imageWidth / 2) * scale;
  const worldZ = -(visualY + actualWindowHeight / 2 - imageHeight / 2) * scale;
  
  // Animate processed windows
  useFrame((_) => {
    if (meshRef.current && isProcessed) {
      //meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 + windowInfo.windowIndex) * 0.1;
    }
  });

  // Load texture for this specific window region
  const texture = useLoader(TextureLoader, imageSrc);
  
  // Create cropped texture for this window
  const croppedTexture = useMemo(() => {
    if (!texture) return null;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = WINDOW_SIZE;
    canvas.height = WINDOW_SIZE;
    
    // This is a simplified version - in reality you'd need to crop the texture
    // For now, we'll use the full texture and adjust UV mapping
    const clonedTexture = texture.clone();
    clonedTexture.needsUpdate = true;
    
    // Adjust UV mapping to show only this window's region
    const offsetX = windowInfo.x / imageWidth;
    const offsetY = windowInfo.y / imageHeight;
    const scaleX = actualWindowWidth / imageWidth;  // Use actual width
    const scaleY = actualWindowHeight / imageHeight;  // Use actual height
    
    clonedTexture.offset.set(offsetX, offsetY);
    clonedTexture.repeat.set(scaleX, scaleY);
    
    return clonedTexture;
  }, [texture, windowInfo, imageWidth, imageHeight]);

  return (
    <group position={[worldX, 0, worldZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[actualWindowWidth * scale, actualWindowHeight * scale]} />
        <meshBasicMaterial
          map={croppedTexture}
          transparent
          opacity={isProcessed ? 1 : 0.6}
          color={hovered ? '#ffffff' : isProcessed ? '#ffffff' : '#cccccc'}
        />
      </mesh>
      
      {/* Window border */}
      <lineSegments>
        <edgesGeometry args={[new PlaneGeometry(actualWindowWidth * scale, actualWindowHeight * scale)]} />
        <lineBasicMaterial 
          color={isProcessed ? '#00ff00' : '#ffaa00'} 
          linewidth={2}
        />
      </lineSegments>
      
      {/* Detection markers */}
      {windowInfo.detections.map((detection, idx) => {
        const [x1, y1, x2, y2] = detection.bbox;
        const detX = ((x1 + x2) / 2 - windowInfo.x - actualWindowWidth / 2) * scale;
        const detZ = -((y1 + y2) / 2 - windowInfo.y - actualWindowHeight / 2) * scale;
        
        return (
          <group key={idx} position={[detX, 0.1, detZ]}>
            <mesh>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
            
            {hovered && (
              <Html>
                <div className="bg-black text-white px-2 py-1 rounded text-xs">
                  Confidence: {(detection.confidence * 100).toFixed(1)}%
                </div>
              </Html>
            )}
          </group>
        );
      })}
      
      {/* Window info */}
      {hovered && (
        <Html position={[0, actualWindowHeight * scale / 2 + 0.2, 0]}>
          <div className="bg-blue-600 text-white px-3 py-2 rounded shadow-lg text-sm">
            <div>Window {windowInfo.windowIndex + 1}</div>
            <div>Detections: {windowInfo.detections.length}</div>
            <div>Status: {isProcessed ? 'Completed' : 'Processing...'}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

// Ground plane component
const GroundPlane: React.FC<{ imageWidth: number; imageHeight: number; scale: number }> = ({
  imageWidth,
  imageHeight,
  scale
}) => {
  // Calculate world position with visual gap for better presentation
  const gapX = Math.floor(imageWidth / WINDOW_SIZE) * GAP_SIZE * scale;
  const gapY = Math.floor(imageHeight / WINDOW_SIZE) * GAP_SIZE * scale;
  return (
    <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[imageWidth * scale + gapX, imageHeight * scale + gapY]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
    </mesh>
  );
};

// Main 3D scene component
const Scene: React.FC<{
  windows: WindowInfo[];
  imageWidth: number;
  imageHeight: number;
  imageSrc: string;
  currentWindow: number;
}> = ({ windows, imageWidth, imageHeight, imageSrc, currentWindow }) => {
  const scale = Math.min(10 / Math.max(imageWidth, imageHeight), 0.01);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      {/* demo point to the center */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color="blue" />
      </mesh>


      <GroundPlane imageWidth={imageWidth} imageHeight={imageHeight} scale={scale} />
      
      {windows.map((windowInfo) => (
        <WindowPlane
          key={windowInfo.windowIndex}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          windowInfo={windowInfo}
          imageSrc={imageSrc}
          scale={scale}
          currentWindow={currentWindow}
        />
      ))}
      
      {/* Progress indicator */}
      <Text
        position={[0, imageHeight * scale * 0.6, 0]}
        fontSize={0.5}
        color="#333333"
        anchorX="center"
        anchorY="middle"
      >
        {currentWindow} / {windows.length} windows processed
      </Text>
      
      <MapControls
        enablePan={true}
        enableZoom={true}
        enableRotate={false}  // Rotate kapalı
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={0.1}
        maxDistance={25}
        // Map-style controls: Left click = pan, Right click = rotate (if enabled)
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN  // Right click da pan olsun
        }}
      />
    </>
  );
};

const ImageViewer3D: React.FC<ImageViewer3DProps> = ({
  imageSrc,
  imageWidth,
  imageHeight,
  predictions = [],
  currentWindow = 0
}) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);

  // Generate window grid
  useEffect(() => {
    const windowsArray: WindowInfo[] = [];
    
    if (imageWidth <= WINDOW_SIZE && imageHeight <= WINDOW_SIZE) {
      // Single window for small images
      windowsArray.push({
        windowIndex: 0,
        x: 0,
        y: 0,
        detections: predictions,
      });
    } else {
      // Multi-window for large images with visual gaps for better presentation
      // Server uses overlap for processing, but we use gaps for visual clarity
      
      // Calculate how many windows fit with gaps
      const numWindowsH = Math.ceil(imageHeight / WINDOW_SIZE);
      const numWindowsW = Math.ceil(imageWidth / WINDOW_SIZE);
      
      let windowIndex = 0;
      
      for (let i = 0; i < numWindowsH; i++) {
        for (let j = 0; j < numWindowsW; j++) {
          // Calculate actual window position in original image (without gaps)
          const startY = i * WINDOW_SIZE;
          const startX = j * WINDOW_SIZE;
          
          const endY = Math.min(startY + WINDOW_SIZE, imageHeight);
          const endX = Math.min(startX + WINDOW_SIZE, imageWidth);
          
          // Find detections in this window
          const windowDetections = predictions.filter(pred => {
            const [x1, y1, x2, y2] = pred.bbox;
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
            return centerX >= startX && centerX <= endX && 
                   centerY >= startY && centerY <= endY;
          });
          
          windowsArray.push({
            windowIndex,
            x: startX,
            y: startY,
            detections: windowDetections
          });
          
          windowIndex++;
        }
      }
    }
    
    setWindows(windowsArray);
  }, [imageWidth, imageHeight, predictions, currentWindow]);

  return (
    <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 15, 0], fov: 50 }}>
        <Scene
          windows={windows}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          imageSrc={imageSrc}
          currentWindow={currentWindow}
        />
      </Canvas>
      
      {/* Controls info */}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
        Click & Drag: Pan | Wheel: Zoom
      </div>
    </div>
  );
};

export default ImageViewer3D;
