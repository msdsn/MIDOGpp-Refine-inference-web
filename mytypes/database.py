from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Database Models (cleaned up)

class ImageRow(BaseModel):
    id: str
    created_at: datetime
    profile_id: Optional[str] = None
    is_test_image: bool
    s3_key: str
    s3_url: Optional[str] = None
    s3_url_expires_at: Optional[datetime] = None
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    
    

class Analysis(BaseModel):
    id: str
    created_at: datetime
    profile_id: str
    image_id: str
    model_name: str
    status: str  # 'processing', 'completed', 'failed'
    total_windows: int
    current_window: int
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    

class AnalysisDetection(BaseModel):
    id: str
    analysis_id: str
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    confidence: float
    class_id: int
    window_index: int