from fastapi import FastAPI, WebSocket, HTTPException, Request, File, UploadFile
from typing import Union, List, Dict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketDisconnect
import os
from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
import io
import base64
import math
import boto3
from botocore.exceptions import ClientError
import uuid
from pydantic import BaseModel
from decouple import config

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='') 
AWS_REGION = config('AWS_REGION', default='us-east-1')
S3_BUCKET_NAME = config('S3_BUCKET_NAME', default='midog-inference-uploads')

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
) if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY else None

# Pydantic models for request/response
class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str

class AnalyzeS3Request(BaseModel):
    s3_key: str

class AnalyzeTestImageRequest(BaseModel):
    test_image_name: str

# Load YOLO model
model = YOLO("best.pt")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Güvenlik için burada belirli origin'leri belirtmek daha iyidir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sliding_window_inference(image_array, model, window_size=640, overlap_ratio=0.2):
    """
    Perform sliding window inference on large images
    
    Args:
        image_array: Input image as numpy array
        model: YOLO model
        window_size: Size of each window (640x640)
        overlap_ratio: Overlap ratio between windows (0.2 = 20% overlap)
    
    Returns:
        List of predictions with adjusted coordinates
    """
    h, w = image_array.shape[:2]
    
    # Calculate step size based on overlap
    step_size = int(window_size * (1 - overlap_ratio))
    
    all_predictions = []
    
    # Calculate number of windows needed
    num_windows_h = math.ceil((h - window_size) / step_size) + 1 if h > window_size else 1
    num_windows_w = math.ceil((w - window_size) / step_size) + 1 if w > window_size else 1
    
    for i in range(num_windows_h):
        for j in range(num_windows_w):
            # Calculate window coordinates
            start_y = min(i * step_size, h - window_size) if h > window_size else 0
            start_x = min(j * step_size, w - window_size) if w > window_size else 0
            end_y = min(start_y + window_size, h)
            end_x = min(start_x + window_size, w)
            
            # Extract window
            window = image_array[start_y:end_y, start_x:end_x]
            
            # Resize window to exactly 640x640 if needed
            if window.shape[0] != window_size or window.shape[1] != window_size:
                window = cv2.resize(window, (window_size, window_size))
            
            # Run inference on window
            results = model(window)
            
            # Process results for this window
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get bounding box coordinates (relative to window)
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = model.names[class_id] if class_id < len(model.names) else f"Class_{class_id}"
                        
                        # Scale coordinates back to window size if image was resized
                        actual_window_h = end_y - start_y
                        actual_window_w = end_x - start_x
                        
                        if actual_window_h != window_size or actual_window_w != window_size:
                            scale_y = actual_window_h / window_size
                            scale_x = actual_window_w / window_size
                            x1 *= scale_x
                            x2 *= scale_x
                            y1 *= scale_y
                            y2 *= scale_y
                        
                        # Adjust coordinates to global image coordinate system
                        global_x1 = x1 + start_x
                        global_y1 = y1 + start_y
                        global_x2 = x2 + start_x
                        global_y2 = y2 + start_y
                        
                        # Ensure coordinates are within image bounds
                        global_x1 = max(0, min(global_x1, w))
                        global_y1 = max(0, min(global_y1, h))
                        global_x2 = max(0, min(global_x2, w))
                        global_y2 = max(0, min(global_y2, h))
                        
                        # Only add if bounding box is valid
                        if global_x2 > global_x1 and global_y2 > global_y1:
                            all_predictions.append({
                                "bbox": [float(global_x1), float(global_y1), float(global_x2), float(global_y2)],
                                "confidence": confidence,
                                "class_id": class_id,
                                "class_name": class_name
                            })
    
    return all_predictions

def non_max_suppression_custom(predictions, iou_threshold=0.5):
    """
    Apply Non-Maximum Suppression to remove overlapping detections
    
    Args:
        predictions: List of prediction dictionaries
        iou_threshold: IoU threshold for NMS
    
    Returns:
        Filtered list of predictions
    """
    if len(predictions) == 0:
        return predictions
    
    # Sort by confidence score (descending)
    predictions = sorted(predictions, key=lambda x: x['confidence'], reverse=True)
    
    filtered_predictions = []
    
    for current_pred in predictions:
        keep = True
        current_bbox = current_pred['bbox']
        
        for kept_pred in filtered_predictions:
            kept_bbox = kept_pred['bbox']
            
            # Calculate IoU
            iou = calculate_iou(current_bbox, kept_bbox)
            
            if iou > iou_threshold:
                keep = False
                break
        
        if keep:
            filtered_predictions.append(current_pred)
    
    return filtered_predictions

def calculate_iou(bbox1, bbox2):
    """
    Calculate Intersection over Union (IoU) of two bounding boxes
    
    Args:
        bbox1, bbox2: [x1, y1, x2, y2] format
    
    Returns:
        IoU value
    """
    x1_1, y1_1, x2_1, y2_1 = bbox1
    x1_2, y1_2, x2_2, y2_2 = bbox2
    
    # Calculate intersection area
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i <= x1_i or y2_i <= y1_i:
        return 0.0
    
    intersection_area = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Calculate union area
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = area1 + area2 - intersection_area
    
    if union_area == 0:
        return 0.0
    
    return intersection_area / union_area

@app.post("/generate-presigned-url")
async def generate_presigned_url(request: PresignedUrlRequest):
    """
    Generate presigned URL for direct S3 upload
    """
    if not s3_client:
        raise HTTPException(
            status_code=500, 
            detail="AWS S3 not configured. Please check environment variables."
        )
    
    try:
        # Validate file format
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.tiff', '.tif'}
        file_extension = os.path.splitext(request.filename.lower())[1]
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format. Supported formats: PNG, JPG, JPEG, TIFF, TIF"
            )
        
        # Generate unique S3 key
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        s3_key = f"uploads/{unique_filename}"
        
        # Generate presigned URL for PUT operation
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET_NAME,
                'Key': s3_key,
                'ContentType': request.content_type
            },
            ExpiresIn=3600  # URL expires in 1 hour
        )
        
        return JSONResponse({
            "presigned_url": presigned_url,
            "s3_key": s3_key,
            "expires_in": 3600
        })
        
    except ClientError as e:
        print(f"AWS S3 error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating presigned URL: {str(e)}")

@app.post("/analyze-s3")
async def analyze_s3_image(request: AnalyzeS3Request):
    """
    Analyze image uploaded to S3 using YOLO model
    """
    if not s3_client:
        raise HTTPException(
            status_code=500, 
            detail="AWS S3 not configured. Please check environment variables."
        )
    
    try:
        # Download image from S3
        print(f"Downloading image from S3: {request.s3_key}")
        
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=request.s3_key)
        image_content = response['Body'].read()
        
        # Get file extension from S3 key
        file_extension = os.path.splitext(request.s3_key.lower())[1]
        
        # Convert to PIL Image with explicit TIFF support
        try:
            image = Image.open(io.BytesIO(image_content))
            
            # Convert to RGB if needed (TIFF files can be in various color modes)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Convert RGBA, LA, or palette to RGB
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            elif image.mode not in ('RGB', 'L'):
                # Convert any other mode to RGB
                image = image.convert('RGB')
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid or corrupted image file: {str(e)}")
        
        # Convert PIL to numpy array
        img_array = np.array(image)
        
        # Get original image dimensions
        original_height, original_width = img_array.shape[:2]
        
        print(f"Processing {file_extension.upper()} image of size: {original_width}x{original_height}")
        
        # Perform sliding window inference
        if original_width <= 640 and original_height <= 640:
            # Small image, process directly
            results = model(img_array)
            predictions = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = model.names[class_id] if class_id < len(model.names) else f"Class_{class_id}"
                        
                        predictions.append({
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": confidence,
                            "class_id": class_id,
                            "class_name": class_name
                        })
        else:
            # Large image, use sliding window approach
            print("Using sliding window inference for large image...")
            predictions = sliding_window_inference(img_array, model, window_size=640, overlap_ratio=0.2)
            
            # Apply Non-Maximum Suppression to remove overlapping detections
            print(f"Before NMS: {len(predictions)} detections")
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
            print(f"After NMS: {len(predictions)} detections")
        
        # Convert image to base64 for frontend display (always as PNG for consistency)
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        print(f"Returning {len(predictions)} final detections")
        
        # Clean up S3 file after processing (optional)
        try:
            s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=request.s3_key)
            print(f"Cleaned up S3 file: {request.s3_key}")
        except Exception as e:
            print(f"Warning: Could not delete S3 file {request.s3_key}: {str(e)}")
        
        return JSONResponse({
            "predictions": predictions,
            "image": f"data:image/png;base64,{img_base64}",
            "image_width": original_width,
            "image_height": original_height,
            "total_detections": len(predictions),
            "processing_info": {
                "original_size": f"{original_width}x{original_height}",
                "original_format": file_extension.upper(),
                "method": "sliding_window" if (original_width > 640 or original_height > 640) else "direct",
                "window_size": "640x640" if (original_width > 640 or original_height > 640) else "direct",
                "source": "s3"
            }
        })
        
    except ClientError as e:
        print(f"AWS S3 error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing S3 image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing S3 image: {str(e)}")

@app.post("/predict")
async def predict_cancer_cells(file: UploadFile = File(...)):
    """
    Cancer cell detection endpoint using YOLO model with sliding window inference
    Supports common pathology image formats: PNG, JPG, JPEG, TIFF, TIF
    """
    try:
        # Validate file format
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.tiff', '.tif'}
        file_extension = os.path.splitext(file.filename.lower())[1] if file.filename else ''
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format. Supported formats: PNG, JPG, JPEG, TIFF, TIF"
            )
        
        # Read uploaded image
        contents = await file.read()
        
        # Convert to PIL Image with explicit TIFF support
        try:
            image = Image.open(io.BytesIO(contents))
            
            # Convert to RGB if needed (TIFF files can be in various color modes)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Convert RGBA, LA, or palette to RGB
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            elif image.mode not in ('RGB', 'L'):
                # Convert any other mode to RGB
                image = image.convert('RGB')
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid or corrupted image file: {str(e)}")
        
        # Convert PIL to numpy array
        img_array = np.array(image)
        
        # Get original image dimensions
        original_height, original_width = img_array.shape[:2]
        
        print(f"Processing {file_extension.upper()} image of size: {original_width}x{original_height}")
        
        # Perform sliding window inference
        if original_width <= 640 and original_height <= 640:
            # Small image, process directly
            results = model(img_array)
            predictions = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = model.names[class_id] if class_id < len(model.names) else f"Class_{class_id}"
                        
                        predictions.append({
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": confidence,
                            "class_id": class_id,
                            "class_name": class_name
                        })
        else:
            # Large image, use sliding window approach
            print("Using sliding window inference for large image...")
            predictions = sliding_window_inference(img_array, model, window_size=640, overlap_ratio=0.2)
            
            # Apply Non-Maximum Suppression to remove overlapping detections
            print(f"Before NMS: {len(predictions)} detections")
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
            print(f"After NMS: {len(predictions)} detections")
        
        # Convert image to base64 for frontend display (always as PNG for consistency)
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        print(f"Returning {len(predictions)} final detections")
        
        return JSONResponse({
            "predictions": predictions,
            "image": f"data:image/png;base64,{img_base64}",
            "image_width": original_width,
            "image_height": original_height,
            "total_detections": len(predictions),
            "processing_info": {
                "original_size": f"{original_width}x{original_height}",
                "original_format": file_extension.upper(),
                "method": "sliding_window" if (original_width > 640 or original_height > 640) else "direct",
                "window_size": "640x640" if (original_width > 640 or original_height > 640) else "direct"
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}

@app.get("/test-images")
async def get_test_images():
    """Get available test images"""
    test_images = [
        {
            "name": "007.jpg",
            "display_name": "Test Sample 007 - H&E Stained Slide",
            "description": "Histological section with multiple mitotic figures",
            "url": "/test-images/007.jpg"
        },
        {
            "name": "024.jpg", 
            "display_name": "Test Sample 024 - H&E Stained Slide",
            "description": "Tissue sample with various cellular structures",
            "url": "/test-images/024.jpg"
        }
    ]
    return JSONResponse({"test_images": test_images})

@app.get("/test-images/{image_name}")
async def serve_test_image(image_name: str):
    """Securely serve only allowed test images"""
    # Only allow specific test images
    allowed_images = ["007.jpg", "024.jpg"]
    
    if image_name not in allowed_images:
        raise HTTPException(status_code=404, detail="Test image not found")
    
    image_path = image_name
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Test image file not found")
    
    return FileResponse(image_path, media_type="image/jpeg")

@app.post("/analyze-test-image")
async def analyze_test_image(request: AnalyzeTestImageRequest):
    """
    Analyze a test image directly from the server
    """
    try:
        # Validate test image name
        allowed_test_images = ["007.jpg", "024.jpg"]
        if request.test_image_name not in allowed_test_images:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid test image. Allowed: {', '.join(allowed_test_images)}"
            )
        
        # Load test image from root folder
        test_image_path = request.test_image_name
        
        if not os.path.exists(test_image_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Test image not found: {request.test_image_name}"
            )
        
        print(f"Analyzing test image: {request.test_image_name}")
        
        # Load and process the image
        try:
            image = Image.open(test_image_path)
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            elif image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid or corrupted test image: {str(e)}")
        
        # Convert PIL to numpy array
        img_array = np.array(image)
        
        # Get original image dimensions
        original_height, original_width = img_array.shape[:2]
        
        print(f"Processing test image of size: {original_width}x{original_height}")
        
        # Perform sliding window inference
        if original_width <= 640 and original_height <= 640:
            # Small image, process directly
            results = model(img_array)
            predictions = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = model.names[class_id] if class_id < len(model.names) else f"Class_{class_id}"
                        
                        predictions.append({
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": confidence,
                            "class_id": class_id,
                            "class_name": class_name
                        })
        else:
            # Large image, use sliding window approach
            print("Using sliding window inference for large test image...")
            predictions = sliding_window_inference(img_array, model, window_size=640, overlap_ratio=0.2)
            
            # Apply Non-Maximum Suppression to remove overlapping detections
            print(f"Before NMS: {len(predictions)} detections")
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
            print(f"After NMS: {len(predictions)} detections")
        
        # Convert image to base64 for frontend display
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        print(f"Returning {len(predictions)} detections for test image {request.test_image_name}")
        
        return JSONResponse({
            "predictions": predictions,
            "image": f"data:image/png;base64,{img_base64}",
            "image_width": original_width,
            "image_height": original_height,
            "total_detections": len(predictions),
            "processing_info": {
                "original_size": f"{original_width}x{original_height}",
                "original_format": "JPG",
                "method": "sliding_window" if (original_width > 640 or original_height > 640) else "direct",
                "window_size": "640x640" if (original_width > 640 or original_height > 640) else "direct",
                "source": "test_image",
                "test_image_name": request.test_image_name
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing test image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing test image: {str(e)}")

@app.get("/{full_path:path}")
async def serve_react_app(request: Request, full_path: str):
    file_path = os.path.join('app', 'dist', full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    else:
        return FileResponse(os.path.join('app', 'dist', 'index.html'))
    







