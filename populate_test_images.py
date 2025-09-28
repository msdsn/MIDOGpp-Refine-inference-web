import os
import hashlib
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client
from decouple import config
import uuid
import boto3
import io

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='') 
AWS_REGION = config('AWS_REGION', default='us-east-1')
S3_BUCKET_NAME = config('S3_BUCKET_NAME', default='midog-inference-uploads')

# Supabase Configuration
SUPABASE_URL = config('SUPABASE_URL', default='')
SUPABASE_KEY = config('SUPABASE_KEY', default='')

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
) if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY else None

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def calculate_file_hash(file_path: Path) -> str:
    """Calculate SHA256 hash of file"""
    with open(file_path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

def get_image_dimensions(file_content: bytes) -> tuple:
    """Get image dimensions using PIL"""
    try:
        from PIL import Image
        with Image.open(io.BytesIO(file_content)) as img:
            return img.width, img.height
    except Exception as e:
        print(f"Warning: Could not get dimensions: {e}")
        return 640, 640  # Default size

def populate_test_images():
    """Populate database with test images"""
    if not supabase:
        print("Error: Supabase not configured")
        return
    
    # Array to collect image IDs
    image_ids = []
    
    # Clear existing test images (optional - be careful in production!)
    print("Clearing existing images...")
    try:
        supabase.table("images").delete().execute()
        print("✅ Cleared existing images")
    except Exception as e:
        print(f"Warning: Could not clear images: {e}")
    
    test_images = [
        "007.jpg", "024.jpg", "026.jpg", "028.jpg", "031.jpg", "033.jpg",
        "036.jpg", "037.jpg", "041.jpg", "045.jpg", "052.jpg", "081.jpg",
        "084.jpg", "088.jpg", "090.jpg"
    ]
    objects = {}

    system_profile_id = "092c1fc7-eefa-4a28-9c51-29b4c8d891c3"
    
    # Process each test image
    for image_name in test_images:
        try:
            print(f"Processing: {image_name}")

            file = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=f"tests/{image_name}")
            image_content = file['Body'].read()
            image_width, image_height = get_image_dimensions(image_content)

            # Create database record for pre-existing S3 object under test-images/
            image_id = str(uuid.uuid4())
            s3_key = f"tests/{image_name}"
            image_data = {
                "id": image_id,
                "s3_key": s3_key,
                "is_test_image": True,
                "profile_id": system_profile_id,
                "file_size": len(image_content),
                "image_width": image_width,
                "image_height": image_height
                
            }

            # Insert into database
            supabase.table("images").insert(image_data).execute()
            image_ids.append(image_id)
            objects[image_id] = s3_key

            # Print mapping for frontend usage
            print(f"TEST_IMAGE: image_id={image_id} s3_key={s3_key}")

        except Exception as e:
            print(f"❌ Error processing {image_name}: {e}")
    
    print(f"\n✅ Database population completed!")
    print(objects)

if __name__ == "__main__":
    populate_test_images()