from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# Request Models
class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str

class AnalyzeRequest(BaseModel):
    analysis_id: str
    model_name: str
    image_id: str
    s3_key: str
    is_test_image: bool = False

class AnalyzeTestImageRequest(BaseModel):
    test_image_name: str
    image_id: str

# Response Models
class PresignedUrlResponse(BaseModel):
    presigned_url: str
    s3_key: str
    expires_in: int

class ProcessingInfo(BaseModel):
    original_size: str
    original_format: str
    method: str
    window_size: str
    source: str

class BoundingBox(BaseModel):
    bbox: List[float]  # [x1, y1, x2, y2]
    confidence: float
    class_id: int

class AnalysisResponse(BaseModel):
    predictions: List[BoundingBox]
    image_width: int
    image_height: int
    total_detections: int
    analysis_id: Optional[str] = None
    image_id: Optional[str] = None
    processing_info: ProcessingInfo

class ImageResponse(BaseModel):
    presigned_url: str
    expires_in: int

class AnalysisDetailsResponse(BaseModel):
    analysis: Dict[str, Any]
    image_url: Optional[str] = None

class AnalysesListResponse(BaseModel):
    analyses: List[Dict[str, Any]]
    total: int

class TestImage(BaseModel):
    name: str
    url: str

class TestImagesResponse(BaseModel):
    test_images: List[TestImage]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool