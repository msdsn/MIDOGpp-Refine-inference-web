#!/usr/bin/env python3
"""
S3 Image Downloader Script
This script downloads images from AWS S3 bucket for local testing/validation.
"""

import os
import json
import boto3
from pathlib import Path
import uuid
from datetime import datetime
from typing import List
from decouple import config
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

class S3ImageDownloader:
    """Class to handle S3 image downloading"""
    
    def __init__(self, download_dir: str = "test-image"):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(exist_ok=True)
        
        self.downloaded_files = []
        
    def list_s3_objects(self, prefix: str = "tests/") -> List[str]:
        """List objects in S3 bucket"""
        if not s3_client:
            logger.error("AWS S3 not configured. Please check environment variables.")
            return []
        
        try:
            logger.info(f"Listing S3 objects with prefix: {prefix}")
            response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix=prefix)
            
            if 'Contents' in response:
                objects = [obj['Key'] for obj in response['Contents']]
                logger.info(f"Found {len(objects)} objects in S3")
                return objects
            else:
                logger.info("No objects found in S3 bucket")
                return []
                
        except Exception as e:
            logger.error(f"Error listing S3 objects: {str(e)}")
            return []
    
    def download_from_s3(self, s3_keys: List[str]) -> int:
        """Download images from S3 bucket"""
        if not s3_client:
            logger.error("AWS S3 not configured. Cannot download from S3.")
            return 0
        
        if not s3_keys:
            logger.info("No S3 keys provided for download")
            return 0
        
        logger.info(f"Starting download of {len(s3_keys)} images from S3...")
        
        downloaded_count = 0
        for s3_key in s3_keys:
            try:
                # Download image from S3
                logger.info(f"Downloading: {s3_key}")
                response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
                image_content = response['Body'].read()
                
                # Get filename from S3 key
                filename = os.path.basename(s3_key)
                if not filename or not any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif']):
                    # Generate filename if not valid image extension
                    filename = f"s3_image_{uuid.uuid4().hex[:8]}.jpg"
                
                # Save image
                dest_path = self.download_dir / filename
                with open(dest_path, 'wb') as f:
                    f.write(image_content)
                
                # Record downloaded file
                file_info = {
                    "filename": filename,
                    "s3_key": s3_key,
                    "downloaded_at": datetime.now().isoformat(),
                    "file_size": len(image_content),
                    "local_path": str(dest_path)
                }
                self.downloaded_files.append(file_info)
                
                downloaded_count += 1
                logger.info(f"✅ Downloaded: {filename} ({len(image_content)} bytes)")
                
            except Exception as e:
                logger.error(f"❌ Error downloading {s3_key}: {str(e)}")
        
        logger.info(f"Download completed. {downloaded_count}/{len(s3_keys)} files downloaded successfully.")
        return downloaded_count
    
    def save_download_log(self):
        """Save download log as JSON"""
        log_file = self.download_dir / "download_log.json"
        
        log_data = {
            "download_timestamp": datetime.now().isoformat(),
            "total_downloaded": len(self.downloaded_files),
            "download_directory": str(self.download_dir),
            "files": self.downloaded_files
        }
        
        with open(log_file, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        logger.info(f"Download log saved to: {log_file}")
        return log_file
    
    def download_all_from_s3(self, prefix: str = "tests/", max_files: int = None) -> int:
        """Download all images from S3 with optional limit"""
        logger.info("🔽 Starting S3 image download...")
        
        # List all objects
        s3_keys = self.list_s3_objects(prefix)
        
        if not s3_keys:
            logger.warning("No files found in S3 to download")
            return 0
        
        # Apply file limit if specified
        if max_files and len(s3_keys) > max_files:
            logger.info(f"Limiting download to {max_files} most recent files")
            s3_keys = s3_keys[-max_files:]  # Get most recent files
        
        # Download files
        downloaded_count = self.download_from_s3(s3_keys)
        
        # Save log
        self.save_download_log()
        
        # Print summary
        print(f"""
📁 Download Summary
==================
Downloaded: {downloaded_count} files
Location: {self.download_dir}
Log file: {self.download_dir}/download_log.json

Recent downloads:
""")
        
        for file_info in self.downloaded_files[-5:]:  # Show last 5 files
            print(f"  • {file_info['filename']} ({file_info['file_size']} bytes)")
        
        return downloaded_count

def main():
    """Main function"""
    print("📥 S3 Image Downloader")
    print("=" * 30)
    
    # Initialize downloader
    downloader = S3ImageDownloader()
    
    try:
        # Download all images from S3
        total_downloaded = downloader.download_all_from_s3(
            prefix="tests/",
            max_files=50  # Download max 50 test files
        )
        
        if total_downloaded > 0:
            print(f"\n✅ Successfully downloaded {total_downloaded} images from S3!")
            print(f"📁 Images saved to: {downloader.download_dir}")
        else:
            print(f"\n⚠️  No images were downloaded. Check S3 configuration and bucket contents.")
            
    except Exception as e:
        logger.error(f"Error during download: {str(e)}")
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    main() 