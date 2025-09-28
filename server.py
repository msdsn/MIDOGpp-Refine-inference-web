from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
import io
import math
import boto3
from botocore.exceptions import ClientError
import uuid
from decouple import config
from pathlib import Path
from datetime import datetime, timedelta
import hashlib
from supabase import create_client, Client
import jwt
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

# Import our types and constants
from mytypes.api import *
from mytypes.database import *
from constants import *

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

# Models are now imported from types.api

# Load YOLO model
model = YOLO("best.pt")

# Initialize background task executor for database operations
background_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="db_task")

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



def non_max_suppression_custom(predictions):
    """
    Apply Non-Maximum Suppression to remove overlapping detections using constant threshold
    
    Args:
        predictions: List of prediction dictionaries
    
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
            
            if iou > IOU_THRESHOLD:
                keep = False
                break
        
        if keep:
            filtered_predictions.append(current_pred)
    
    return filtered_predictions



def apply_realtime_nms_single(new_detection, all_predictions):
    """
    Apply NMS for a single new detection against all existing predictions
    Either adds the new detection or replaces an existing one with higher confidence
    
    Args:
        new_detection: Single new detection dictionary
        all_predictions: List of all existing predictions (modified in place)
    
    Returns:
        True if detection was added/updated, False if rejected
    """
    new_bbox = new_detection['bbox']
    new_confidence = new_detection['confidence']
    
    # Check against all existing predictions
    for i, existing_det in enumerate(all_predictions):
        existing_bbox = existing_det['bbox']
        existing_confidence = existing_det['confidence']
        
        # Calculate IoU
        iou = calculate_iou(new_bbox, existing_bbox)
        
        # If IoU is high, keep the one with higher confidence
        if iou > IOU_THRESHOLD:
            if new_confidence > existing_confidence:
                # Replace existing detection with new one (higher confidence)
                all_predictions[i] = new_detection
                return True
            else:
                # Keep existing detection (higher or equal confidence)
                return False
    
    # No overlap found, add new detection
    all_predictions.append(new_detection)
    return True

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
        allowed_extensions = ALLOWED_EXTENSIONS
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

@app.post("/analyze")
async def analyze_image(request: AnalyzeRequest, http_request: Request):
    """
    Analyze image using YOLO model - accepts either image_id or s3_key
    """
    if not s3_client:
        raise HTTPException(
            status_code=500, 
            detail="AWS S3 not configured. Please check environment variables."
        )
    # Get profile ID from authentication token
    profile_id = await get_profile_id_from_token(http_request)
    is_test_image = request.is_test_image
    
    # Get image info - either from image_id or s3_key
    image_id = request.image_id
    s3_key = request.s3_key
    model_name = request.model_name

    analysis_id = request.analysis_id
    
    try:
        # Download image from S3
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        image_content = response['Body'].read()
        # Calculate file hash
        file_hash = calculate_file_hash(image_content)
        
        # Convert to PIL Image with explicit TIFF support
        try:
            image_buffer = io.BytesIO(image_content)
            image_buffer.seek(0)
            image = Image.open(image_buffer)
            
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
        # Resolve image_id behavior for test vs normal image
        if not is_test_image:
            # For normal images, save image metadata to Supabase
            try:
                image_id = await save_image_to_supabase(
                    profile_id=profile_id,
                    image_id=image_id,
                    s3_key=s3_key,
                    file_size=len(image_content),
                    image_width=original_width,
                    image_height=original_height,
                    file_hash=file_hash,
                    is_test_image=False,
                )
            except Exception as e:
                print(f"Warning: Could not save image to Supabase: {str(e)}")
        
        # Calculate total windows for sliding window method
        total_windows = 0
        if original_width > WINDOW_SIZE or original_height > WINDOW_SIZE:
            step_size = WINDOW_SIZE
            num_windows_h = math.ceil((original_height - WINDOW_SIZE) / step_size) + 1 if original_height > WINDOW_SIZE else 1
            num_windows_w = math.ceil((original_width - WINDOW_SIZE) / step_size) + 1 if original_width > WINDOW_SIZE else 1
            total_windows = num_windows_h * num_windows_w
        
        # Create analysis record
        try:
            await create_analysis_record(
                analysis_id=analysis_id,
                profile_id=profile_id,
                image_id=image_id,
                model_name=model_name,
                total_windows=total_windows
            )
        except Exception as e:
            print(f"Warning: Could not create analysis record: {str(e)}")
        
        # Perform sliding window inference with real-time detection saving
        if original_width <= WINDOW_SIZE and original_height <= WINDOW_SIZE:
            # Small image, process directly with real-time NMS
            results = model(img_array)
            
            detections_to_save = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        new_detection = {
                            "bbox": [float(x1), float(y1), float(x2), float(y2)],
                            "confidence": confidence,
                            "class_id": class_id,
                            "window_index": 0
                        }
                        
                        # Apply NMS even for small images (in case of multiple overlapping detections)
                        if apply_realtime_nms_single(new_detection, detections_to_save):
                            detections_to_save.append(new_detection)
            
            # Save detections for small image using background task
            if detections_to_save:
                detections_copy = [det.copy() for det in detections_to_save]
                submit_background_task(save_window_detections_sync, analysis_id, detections_copy, 0)
            submit_background_task(update_analysis_progress_sync, analysis_id, 1)
        else:
            # Large image, use sliding window approach with real-time NMS and background DB saving
            sliding_window_inference_with_progress(img_array, model, analysis_id)
        
        # For small images, also submit completion task to background
        if original_width <= WINDOW_SIZE and original_height <= WINDOW_SIZE:
            submit_background_task(complete_analysis_sync, analysis_id)
        
        # DON'T DELETE THE S3 FILE - Keep it for future access
        # The file will remain in S3 and can be accessed later via the s3_key
        
        return JSONResponse({"completed": True})
        
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

def sliding_window_inference_with_progress(image_array, model, analysis_id):
    """
    Perform sliding window inference with progress tracking
    Real-time NMS and background database saving for each detection
    """
    h, w = image_array.shape[:2]
    
    # Calculate step size based on overlap
    step_size = WINDOW_SIZE
    
    detections = []
    
    # Calculate number of windows needed
    num_windows_h = math.ceil((h - WINDOW_SIZE) / step_size) + 1 if h > WINDOW_SIZE else 1
    num_windows_w = math.ceil((w - WINDOW_SIZE) / step_size) + 1 if w > WINDOW_SIZE else 1
    
    window_index = 0
    
    for i in range(num_windows_h):
        for j in range(num_windows_w):
            
            # Calculate window coordinates
            start_y = min(i * step_size, h - WINDOW_SIZE) if h > WINDOW_SIZE else 0
            start_x = min(j * step_size, w - WINDOW_SIZE) if w > WINDOW_SIZE else 0
            end_y = min(start_y + WINDOW_SIZE, h)
            end_x = min(start_x + WINDOW_SIZE, w)
            
            # Extract window
            window = image_array[start_y:end_y, start_x:end_x]
            
            # Resize window to exactly 640x640 if needed
            if window.shape[0] != WINDOW_SIZE or window.shape[1] != WINDOW_SIZE:
                window = cv2.resize(window, (WINDOW_SIZE, WINDOW_SIZE))
            
            # Run inference on window (this is the time-consuming part)
            results = model(window)
            
            # Process each detection individually with real-time NMS
            detections_to_save = []
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get bounding box coordinates (relative to window)
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())

                        
                        # Scale coordinates back to window size if image was resized
                        actual_window_h = end_y - start_y
                        actual_window_w = end_x - start_x
                        
                        if actual_window_h != WINDOW_SIZE or actual_window_w != WINDOW_SIZE:
                            scale_y = actual_window_h / WINDOW_SIZE
                            scale_x = actual_window_w / WINDOW_SIZE
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
                        
                        # Only process if bounding box is valid
                        if global_x2 > global_x1 and global_y2 > global_y1:
                            new_detection = {
                                "bbox": [float(global_x1), float(global_y1), float(global_x2), float(global_y2)],
                                "confidence": confidence,
                                "class_id": class_id,
                                "window_index": window_index
                            }
                            
                            # Apply real-time NMS - check against all existing predictions
                            if apply_realtime_nms_single(new_detection, detections):
                                # Detection was added or updated, add to save list
                                detections_to_save.append(new_detection)
                                detections.append(new_detection)
            
            # Submit database operations to background executor (non-blocking)
            if detections_to_save:
                # Make a deep copy of detections_to_save for background task
                detections_copy = [det.copy() for det in detections_to_save]
                submit_background_task(save_window_detections_sync, analysis_id, detections_copy, window_index)
            
            # Update progress in background (non-blocking)
            submit_background_task(update_analysis_progress_sync, analysis_id, window_index + 1)
            
            window_index += 1
    
    # Submit completion task to background after all windows are processed
    submit_background_task(complete_analysis_sync, analysis_id)

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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}

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





# Helper functions for Supabase operations
async def get_profile_id_from_token(request: Request) -> str:
    """Extract profile ID from authentication token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = auth_header.replace("Bearer ", "")
    
    # Check if JWT secret is configured
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT Secret not configured")
    
    try:
        # Decode JWT token with Supabase-specific options
        decoded = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], 
                           options={"verify_aud": False, "verify_iss": False})
        return decoded["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

async def save_image_to_supabase(profile_id: str, image_id: str, s3_key: str, file_size: int, 
                               image_width: int, image_height: int, 
                               file_hash: str = None,
                               is_test_image: bool = False) -> str:
    """Save image metadata to Supabase (simplified)"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Generate presigned URL for the image
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )
        
        expires_at = datetime.now() + timedelta(seconds=PRESIGNED_URL_EXPIRY)
        
        image_data = {
            "id": image_id,
            "profile_id": profile_id,
            "is_test_image": is_test_image,
            "s3_key": s3_key,
            "s3_url": presigned_url,
            "s3_url_expires_at": expires_at.isoformat(),
            "file_size": file_size,
            "image_width": image_width,
            "image_height": image_height,
            "file_hash": file_hash,
        }
        
        result = supabase.table("images").insert(image_data).execute()
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
        query = supabase.table("images").select("*").eq("id", image_id)
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
        supabase.table("images").update({
            "s3_url": presigned_url,
            "s3_url_expires_at": expires_at.isoformat()
        }).eq("id", image_id).execute()
        
        return presigned_url
        
    except Exception as e:
        print(f"Error getting/refreshing presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting image URL: {str(e)}")

async def create_analysis_record(analysis_id: str, profile_id: str, image_id: str, model_name: str, total_windows: int = 0) -> str:
    """Create initial analysis record in Supabase (simplified)"""
    if not supabase:
        return None
    
    try:
        analysis_data: Analysis = {
            "id": analysis_id,
            "profile_id": profile_id,
            "image_id": image_id,
            "model_name": model_name,
            "status": AnalysisStatus.PROCESSING,
            "total_windows": total_windows,
            "current_window": 0
        }
        
        result = supabase.table("analyses").insert(analysis_data).execute()
        return result.data[0]["id"]
        
    except Exception as e:
        print(f"Error creating analysis record: {str(e)}")
        return None

def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()

# Sync versions of database functions for background execution
def save_window_detections_sync(analysis_id: str, detections: list, window_index: int):
    """Sync version of save_window_detections for background execution"""
    print("save_window_detections_sync", analysis_id, detections, window_index)
    if not supabase or not analysis_id or not detections:
        return
    
    try:
        detection_data = []
        for detection in detections:
            detection_data.append({
                "analysis_id": analysis_id,
                "bbox_x1": detection["bbox"][0],
                "bbox_y1": detection["bbox"][1],
                "bbox_x2": detection["bbox"][2],
                "bbox_y2": detection["bbox"][3],
                "confidence": detection["confidence"],
                "class_id": detection["class_id"],
                "window_index": window_index
            })
        
        supabase.table("analysis_detections").insert(detection_data).execute()
        print(f"Saved {len(detection_data)} detections for window {window_index}")
        
    except Exception as e:
        print(f"Error saving window detections: {str(e)}")

def update_analysis_progress_sync(analysis_id: str, current_window: int = None):
    """Sync version of update_analysis_progress for background execution"""
    if not supabase or not analysis_id:
        return
    
    try:
        update_data = {}
        if current_window is not None:
            update_data["current_window"] = current_window
        
        if update_data:
            supabase.table("analyses").update(update_data).eq("id", analysis_id).execute()
        
    except Exception as e:
        print(f"Error updating analysis progress: {str(e)}")

def complete_analysis_sync(analysis_id: str):
    """Sync version of complete_analysis for background execution"""
    if not supabase or not analysis_id:
        return
    
    try:
        # Update analysis status - detections are already saved in real-time
        supabase.table("analyses").update({
            "status": AnalysisStatus.COMPLETED,
            "completed_at": datetime.now().isoformat()
        }).eq("id", analysis_id).execute()
        
        print(f"Analysis {analysis_id} completed successfully")
            
    except Exception as e:
        print(f"Error completing analysis: {str(e)}")

def submit_background_task(func, *args, **kwargs):
    """Submit a task to background executor"""
    try:
        background_executor.submit(func, *args, **kwargs)
    except Exception as e:
        print(f"Error submitting background task: {str(e)}")







