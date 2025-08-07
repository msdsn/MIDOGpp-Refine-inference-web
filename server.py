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
from pathlib import Path
import json
from datetime import datetime, timedelta
import hashlib
from supabase import create_client, Client
import jwt

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='') 
AWS_REGION = config('AWS_REGION', default='us-east-1')
S3_BUCKET_NAME = config('S3_BUCKET_NAME', default='midog-inference-uploads')

# Supabase Configuration
SUPABASE_URL = config('SUPABASE_URL', default='')
SUPABASE_KEY = config('SUPABASE_KEY', default='')
SUPABASE_JWT_SECRET = config('SUPABASE_JWT_SECRET', default='')

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
) if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY else None

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

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

# Mount static directories
# Serve test images from S3
if os.path.exists("test-image"):
    app.mount("/test-image", StaticFiles(directory="test-image"), name="test_images")

# Mount React app dist folder
if os.path.exists("app/dist"):
    app.mount("/static", StaticFiles(directory="app/dist"), name="static")

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
async def analyze_s3_image(request: AnalyzeS3Request, http_request: Request):
    """
    Analyze image uploaded to S3 using YOLO model
    """
    if not s3_client:
        raise HTTPException(
            status_code=500, 
            detail="AWS S3 not configured. Please check environment variables."
        )
    
    # Get profile ID from authentication token
    profile_id = await get_profile_id_from_token(http_request)
    analysis_id = None
    
    try:
        # Download image from S3
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=request.s3_key)
        image_content = response['Body'].read()
        
        # Calculate file hash
        file_hash = calculate_file_hash(image_content)
        
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
        
        # Save image metadata to Supabase
        image_id = None
        try:
            original_filename = os.path.basename(request.s3_key)
            image_id = await save_image_to_supabase(
                profile_id=profile_id,
                s3_key=request.s3_key,
                original_filename=original_filename,
                file_size=len(image_content),
                content_type=f"image/{file_extension.lstrip('.')}",
                image_width=original_width,
                image_height=original_height,
                file_format=file_extension.upper(),
                file_hash=file_hash
            )
        except Exception as e:
            print(f"Warning: Could not save image to Supabase: {str(e)}")
        
        # Determine processing method
        processing_method = "sliding_window" if (original_width > 640 or original_height > 640) else "direct"
        
        # Calculate total windows for sliding window method
        total_windows = 0
        if processing_method == "sliding_window":
            window_size = 640
            overlap_ratio = 0.2
            step_size = int(window_size * (1 - overlap_ratio))
            num_windows_h = math.ceil((original_height - window_size) / step_size) + 1 if original_height > window_size else 1
            num_windows_w = math.ceil((original_width - window_size) / step_size) + 1 if original_width > window_size else 1
            total_windows = num_windows_h * num_windows_w
        
        # Create analysis record
        try:
            analysis_id = await create_analysis_record(
                profile_id=profile_id,
                image_id=image_id,
                image_name=original_filename,
                source_type="uploaded",
                processing_method=processing_method,
                total_windows=total_windows
            )
        except Exception as e:
            print(f"Warning: Could not create analysis record: {str(e)}")
        
        # Update progress - image processing stage
        await update_analysis_progress(analysis_id, stage="image_processing")
        
        # Perform sliding window inference
        predictions = []
        
        if original_width <= 640 and original_height <= 640:
            # Small image, process directly
            await update_analysis_progress(analysis_id, stage="window_analysis")
            
            results = model(img_array)
            
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
                            "class_name": class_name,
                            "window_index": 0
                        })
        else:
            # Large image, use sliding window approach
            await update_analysis_progress(analysis_id, stage="window_analysis")
            
            # Modified sliding window function to update progress
            predictions = await sliding_window_inference_with_progress(
                img_array, model, analysis_id, window_size=640, overlap_ratio=0.2
            )
            
            # Apply Non-Maximum Suppression
            await update_analysis_progress(analysis_id, stage="nms_filtering")
            
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
        
        # Complete analysis
        start_time = datetime.now()
        processing_time = (datetime.now() - start_time).total_seconds()
        
        await update_analysis_progress(analysis_id, stage="result_compilation")
        await complete_analysis(analysis_id, len(predictions), processing_time, predictions)
        
        # DON'T DELETE THE S3 FILE - Keep it for future access
        # The file will remain in S3 and can be accessed later via the s3_key
        
        return JSONResponse({
            "predictions": predictions,
            "image_width": original_width,
            "image_height": original_height,
            "total_detections": len(predictions),
            "analysis_id": analysis_id,
            "image_id": image_id,
            "processing_info": {
                "original_size": f"{original_width}x{original_height}",
                "original_format": file_extension.upper(),
                "method": processing_method,
                "window_size": "640x640" if processing_method == "sliding_window" else "direct",
                "source": "s3",
                "total_windows": total_windows
            }
        })
        
    except ClientError as e:
        print(f"AWS S3 error: {str(e)}")
        if analysis_id:
            await update_analysis_error(analysis_id, str(e))
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing S3 image: {str(e)}")
        if analysis_id:
            await update_analysis_error(analysis_id, str(e))
        raise HTTPException(status_code=500, detail=f"Error processing S3 image: {str(e)}")

async def sliding_window_inference_with_progress(image_array, model, analysis_id, window_size=640, overlap_ratio=0.2):
    """
    Perform sliding window inference with progress tracking
    """
    h, w = image_array.shape[:2]
    
    # Calculate step size based on overlap
    step_size = int(window_size * (1 - overlap_ratio))
    
    all_predictions = []
    
    # Calculate number of windows needed
    num_windows_h = math.ceil((h - window_size) / step_size) + 1 if h > window_size else 1
    num_windows_w = math.ceil((w - window_size) / step_size) + 1 if w > window_size else 1
    
    window_index = 0
    
    for i in range(num_windows_h):
        for j in range(num_windows_w):
            # Update progress
            await update_analysis_progress(
                analysis_id, 
                current_window=window_index,
                completed_windows=window_index
            )
            
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
                                "class_name": class_name,
                                "window_index": window_index
                            })
            
            window_index += 1
    
    return all_predictions

async def update_analysis_error(analysis_id: str, error_message: str):
    """Update analysis with error status"""
    if not supabase or not analysis_id:
        return
    
    try:
        supabase.table("analyses").update({
            "status": "failed",
            "error_message": error_message,
            "completed_at": datetime.now().isoformat()
        }).eq("id", analysis_id).execute()
    except Exception as e:
        print(f"Error updating analysis error: {str(e)}")

@app.post("/predict")
async def predict_cancer_cells(file: UploadFile = File(...), request: Request = None):
    """
    Cancer cell detection endpoint using YOLO model with sliding window inference
    Supports common pathology image formats: PNG, JPG, JPEG, TIFF, TIF
    """
    try:
        # Get profile ID from authentication token
        if request:
            profile_id = await get_profile_id_from_token(request)
        
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
            predictions = sliding_window_inference(img_array, model, window_size=640, overlap_ratio=0.2)
            
            # Apply Non-Maximum Suppression to remove overlapping detections
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
        
        return JSONResponse({
            "predictions": predictions,
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
    """Get test images from test-image folder (public endpoint)"""
    test_images = []
    
    # Add test images from S3
    test_image_dir = Path("test-image")
    if test_image_dir.exists():
        # Get all image files
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.tiff', '*.tif']
        for pattern in image_extensions:
            for image_file in test_image_dir.glob(pattern):
                if image_file.is_file():
                    test_images.append({
                        "name": image_file.name,
                        "url": f"/test-image/{image_file.name}"
                    })
    
    return JSONResponse({"test_images": test_images})

@app.post("/analyze-test-image")
async def analyze_test_image(request: AnalyzeTestImageRequest, http_request: Request):
    """
    Analyze a test image from the test-image folder
    """
    try:
        # Get profile ID from authentication token
        profile_id = await get_profile_id_from_token(http_request)
        
        # Validate that image exists in test-image folder
        test_image_dir = Path("test-image")
        image_path = test_image_dir / request.test_image_name
        
        if not image_path.exists() or not image_path.is_file():
            raise HTTPException(
                status_code=404, 
                detail=f"Test image not found: {request.test_image_name}"
            )
        
        # Check file extension
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.tiff', '.tif'}
        file_extension = image_path.suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format: {file_extension}"
            )
        
        # Load and process the image
        try:
            image = Image.open(image_path)
            
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
            predictions = sliding_window_inference(img_array, model, window_size=640, overlap_ratio=0.2)
            
            # Apply Non-Maximum Suppression to remove overlapping detections
            predictions = non_max_suppression_custom(predictions, iou_threshold=0.5)
        
        return JSONResponse({
            "predictions": predictions,
            "image_width": original_width,
            "image_height": original_height,
            "total_detections": len(predictions),
            "processing_info": {
                "original_size": f"{original_width}x{original_height}",
                "original_format": file_extension.upper(),
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

@app.get("/image/{image_id}")
async def get_image(image_id: str, request: Request):
    """
    Get presigned URL for viewing a previously uploaded image
    """
    if not s3_client:
        raise HTTPException(
            status_code=500, 
            detail="AWS S3 not configured. Please check environment variables."
        )
    
    try:
        # Get user ID from authentication token
        profile_id = await get_profile_id_from_token(request)
        
        # Get or refresh presigned URL from Supabase
        presigned_url = await get_or_refresh_presigned_url(image_id, profile_id)
        
        return JSONResponse({
            "presigned_url": presigned_url,
            "expires_in": 86400  # 24 hours
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting image: {str(e)}")

@app.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request):
    """
    Get analysis details including progress and results
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Get user ID from authentication token
        profile_id = await get_profile_id_from_token(request)
        
        # Get analysis with image and detections
        analysis_result = supabase.table("analyses").select("""
            *,
            user_images(*),
            analysis_detections(*)
        """).eq("id", analysis_id).eq("profile_id", profile_id).execute()
        
        if not analysis_result.data:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        analysis = analysis_result.data[0]
        
        # Get presigned URL for the image if it exists
        image_url = None
        if analysis.get("image_id"):
            try:
                image_url = await get_or_refresh_presigned_url(analysis["image_id"], profile_id)
            except Exception as e:
                print(f"Warning: Could not get image URL: {str(e)}")
        
        return JSONResponse({
            "analysis": analysis,
            "image_url": image_url
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting analysis: {str(e)}")

@app.get("/analyses")
async def get_user_analyses(request: Request, limit: int = 50, offset: int = 0):
    """
    Get user's analysis history
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Get user ID from authentication token
        profile_id = await get_profile_id_from_token(request)
        
        # Get analyses with image info
        analyses_result = supabase.table("analyses").select("""
            *,
            user_images(id, original_filename, s3_key, file_size, image_width, image_height)
        """).eq("profile_id", profile_id).order("analysis_date", desc=True).limit(limit).offset(offset).execute()
        
        analyses = analyses_result.data
        
        # Add image URLs for each analysis
        for analysis in analyses:
            if analysis.get("image_id"):
                try:
                    image_url = await get_or_refresh_presigned_url(analysis["image_id"], profile_id)
                    analysis["image_url"] = image_url
                except Exception as e:
                    print(f"Warning: Could not get image URL for analysis {analysis['id']}: {str(e)}")
                    analysis["image_url"] = None
        
        return JSONResponse({
            "analyses": analyses,
            "total": len(analyses)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting analyses: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting analyses: {str(e)}")

# Helper functions for Supabase operations
async def get_profile_id_from_token(request: Request) -> str:
    """Extract profile ID from authentication token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        print("DEBUG: No authorization header found")
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if not auth_header.startswith("Bearer "):
        print(f"DEBUG: Invalid token format: {auth_header[:20]}...")
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = auth_header.replace("Bearer ", "")
    print(f"DEBUG: Token received, length: {len(token)}")
    
    # Check if JWT secret is configured
    if not SUPABASE_JWT_SECRET:
        print("DEBUG: JWT Secret not configured")
        raise HTTPException(status_code=500, detail="JWT Secret not configured")
    
    print(f"DEBUG: JWT Secret configured: {len(SUPABASE_JWT_SECRET)} characters")
    
    try:
        # First decode without verification to see what's inside
        unverified = jwt.decode(token, options={"verify_signature": False})
        print(f"DEBUG: Token payload: {unverified}")
        print(f"DEBUG: Token header: {jwt.get_unverified_header(token)}")
        
        # Try to decode with verification
        # Skip audience and issuer verification for Supabase tokens
        decoded = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False, "verify_iss": False})
        print(f"DEBUG: Token successfully decoded, user_id: {decoded.get('sub')}")
        return decoded["sub"]
    except jwt.ExpiredSignatureError as e:
        print(f"DEBUG: Token expired: {str(e)}")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        print(f"DEBUG: Invalid token error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"DEBUG: Unexpected error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def save_image_to_supabase(profile_id: str, s3_key: str, original_filename: str, 
                               file_size: int, content_type: str, image_width: int, 
                               image_height: int, file_format: str, file_hash: str = None) -> str:
    """Save image metadata to Supabase"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Generate presigned URL for the image
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=86400  # 24 hours
        )
        
        expires_at = datetime.now() + timedelta(hours=24)
        
        image_data = {
            "profile_id": profile_id,
            "s3_key": s3_key,
            "s3_url": presigned_url,
            "s3_url_expires_at": expires_at.isoformat(),
            "original_filename": original_filename,
            "file_size": file_size,
            "content_type": content_type,
            "image_width": image_width,
            "image_height": image_height,
            "file_format": file_format,
            "file_hash": file_hash
        }
        
        result = supabase.table("user_images").insert(image_data).execute()
        return result.data[0]["id"]
        
    except Exception as e:
        print(f"Error saving image to Supabase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving image: {str(e)}")

async def get_or_refresh_presigned_url(image_id: str, profile_id: str = None) -> str:
    """Get presigned URL for image, refresh if expired"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Get image data from Supabase
        query = supabase.table("user_images").select("*").eq("id", image_id)
        if profile_id:
            query = query.eq("profile_id", profile_id)
        
        result = query.execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Image not found")
        
        image_data = result.data[0]
        
        # Check if presigned URL is still valid
        if (image_data["s3_url"] and image_data["s3_url_expires_at"] and 
            datetime.fromisoformat(image_data["s3_url_expires_at"]) > datetime.now()):
            return image_data["s3_url"]
        
        # Generate new presigned URL
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': image_data["s3_key"]},
            ExpiresIn=86400  # 24 hours
        )
        
        expires_at = datetime.now() + timedelta(hours=24)
        
        # Update database with new URL
        supabase.table("user_images").update({
            "s3_url": presigned_url,
            "s3_url_expires_at": expires_at.isoformat()
        }).eq("id", image_id).execute()
        
        return presigned_url
        
    except Exception as e:
        print(f"Error getting/refreshing presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting image URL: {str(e)}")

async def create_analysis_record(profile_id: str, image_id: str, image_name: str, 
                               source_type: str, processing_method: str, 
                               total_windows: int = 0) -> str:
    """Create initial analysis record in Supabase"""
    if not supabase:
        return None
    
    try:
        analysis_data = {
            "profile_id": profile_id,
            "image_id": image_id,
            "image_name": image_name,
            "source_type": source_type, # ?
            "processing_method": processing_method, # ?
            "status": "processing",
            "started_at": datetime.now().isoformat(),
            "processing_progress": {
                "total_windows": total_windows,
                "completed_windows": 0,
                "current_window": None,
                "window_results": [],
                "processing_stages": {
                    "image_upload": True,
                    "image_processing": False,
                    "window_analysis": False,
                    "nms_filtering": False,
                    "result_compilation": False
                }
            }
        }
        
        result = supabase.table("analyses").insert(analysis_data).execute()
        return result.data[0]["id"]
        
    except Exception as e:
        print(f"Error creating analysis record: {str(e)}")
        return None

async def update_analysis_progress(analysis_id: str, stage: str = None, 
                                 current_window: int = None, 
                                 completed_windows: int = None,
                                 window_result: dict = None):
    """Update analysis progress in real-time"""
    if not supabase or not analysis_id:
        return
    
    try:
        # Get current progress
        result = supabase.table("analyses").select("processing_progress").eq("id", analysis_id).execute()
        
        if not result.data:
            return
        
        progress = result.data[0]["processing_progress"]
        
        # Update progress
        if stage:
            progress["processing_stages"][stage] = True
        if current_window is not None:
            progress["current_window"] = current_window
        if completed_windows is not None:
            progress["completed_windows"] = completed_windows
        if window_result:
            progress["window_results"].append(window_result)
        
        # Update database
        supabase.table("analyses").update({
            "processing_progress": progress
        }).eq("id", analysis_id).execute()
        
    except Exception as e:
        print(f"Error updating analysis progress: {str(e)}")

async def complete_analysis(analysis_id: str, total_detections: int, 
                          processing_time: float, detections: list):
    """Complete analysis and save results to Supabase"""
    if not supabase or not analysis_id:
        return
    
    try:
        # Get current progress
        result = supabase.table("analyses").select("processing_progress").eq("id", analysis_id).execute()
        current_progress = result.data[0]["processing_progress"] if result.data else {}
        
        # Update analysis
        supabase.table("analyses").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "processing_time": processing_time,
            "total_detections": total_detections,
            "processing_progress": {
                **current_progress,
                "processing_stages": {
                    "image_upload": True,
                    "image_processing": True,
                    "window_analysis": True,
                    "nms_filtering": True,
                    "result_compilation": True
                }
            }
        }).eq("id", analysis_id).execute()
        
        # Save detections
        if detections:
            detection_data = []
            for i, detection in enumerate(detections):
                detection_data.append({
                    "analysis_id": analysis_id,
                    "bbox_x1": detection["bbox"][0],
                    "bbox_y1": detection["bbox"][1],
                    "bbox_x2": detection["bbox"][2],
                    "bbox_y2": detection["bbox"][3],
                    "confidence": detection["confidence"],
                    "class_id": detection["class_id"],
                    "class_name": detection["class_name"],
                    "detection_order": i,
                    "window_index": detection.get("window_index")
                })
            
            supabase.table("analysis_detections").insert(detection_data).execute()
            
    except Exception as e:
        print(f"Error completing analysis: {str(e)}")

def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()







