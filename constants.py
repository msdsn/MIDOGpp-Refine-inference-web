# Model and processing constants

# YOLO Model Configuration
WINDOW_SIZE = 640
IOU_THRESHOLD = 0.5  # Non-Maximum Suppression threshold
CONFIDENCE_THRESHOLD = 0.25  # Minimum confidence for detections

# File Processing
ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tiff', '.tif'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# S3 Configuration
PRESIGNED_URL_EXPIRY = 86400  # 24 hours in seconds

# Analysis Status
class AnalysisStatus:
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# Processing Methods (for reference, but we only use sliding_window)
PROCESSING_METHOD = "sliding_window"