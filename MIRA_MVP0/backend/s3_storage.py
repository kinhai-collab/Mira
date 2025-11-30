"""
S3 storage utilities for AWS Lambda/App Runner
Replaces local file storage
"""
import boto3
import json
import os
from typing import Optional, List
from datetime import datetime

# Singleton S3 client
_s3_client = None

# Environment detection
IS_LAMBDA = os.getenv('AWS_EXECUTION_ENV') is not None
IS_APP_RUNNER = os.getenv('AWS_EXECUTION_ENV') is not None or os.getenv('PORT') is not None
USE_S3 = IS_LAMBDA or IS_APP_RUNNER or os.getenv('USE_S3', '').lower() == 'true'


def get_s3_client():
    """Get or create S3 client (singleton)"""
    global _s3_client
    if _s3_client is None:
        # Lambda automatically sets AWS_DEFAULT_REGION, boto3 uses it by default
        region = os.getenv('AWS_DEFAULT_REGION') or os.getenv('AWS_REGION', 'us-east-2')
        _s3_client = boto3.client('s3', region_name=region)
    return _s3_client


def get_bucket_name() -> str:
    """Get S3 bucket name"""
    stage = os.getenv('STAGE', 'dev')
    return os.getenv('S3_BUCKET', f'mira-data-{stage}')


# ============================================================================
# JSONL FILE OPERATIONS (for autopilot logs, etc.)
# ============================================================================

def read_jsonl(key: str) -> List[dict]:
    """
    Read JSONL file from S3 or local filesystem
    Returns list of parsed JSON objects
    """
    if not USE_S3:
        # Local fallback
        local_path = os.path.join('data', key)
        if not os.path.exists(local_path):
            return []
        
        with open(local_path, 'r', encoding='utf-8') as f:
            return [json.loads(line) for line in f if line.strip()]
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        response = s3.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        
        if not content.strip():
            return []
        
        return [json.loads(line) for line in content.split('\n') if line.strip()]
    
    except s3.exceptions.NoSuchKey:
        return []
    except Exception as e:
        print(f"⚠️ Error reading JSONL from S3: {e}")
        return []


def append_jsonl(key: str, entry: dict):
    """
    Append entry to JSONL file in S3 or local filesystem
    """
    if not USE_S3:
        # Local fallback
        local_path = os.path.join('data', key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        with open(local_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + '\n')
        return
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        # Read existing content
        try:
            response = s3.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            lines = content.strip().split('\n') if content.strip() else []
        except s3.exceptions.NoSuchKey:
            lines = []
        
        # Append new entry
        lines.append(json.dumps(entry))
        
        # Write back
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body='\n'.join(lines),
            ContentType='application/jsonl',
            Metadata={
                'last_modified': datetime.utcnow().isoformat()
            }
        )
    
    except Exception as e:
        print(f"⚠️ Error appending to JSONL in S3: {e}")


def write_jsonl(key: str, entries: List[dict]):
    """
    Write entire JSONL file to S3 or local filesystem
    Overwrites existing file
    """
    if not USE_S3:
        # Local fallback
        local_path = os.path.join('data', key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        with open(local_path, 'w', encoding='utf-8') as f:
            for entry in entries:
                f.write(json.dumps(entry) + '\n')
        return
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        content = '\n'.join(json.dumps(entry) for entry in entries)
        
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=content,
            ContentType='application/jsonl',
            Metadata={
                'last_modified': datetime.utcnow().isoformat(),
                'entry_count': str(len(entries))
            }
        )
    
    except Exception as e:
        print(f"⚠️ Error writing JSONL to S3: {e}")


# ============================================================================
# GENERIC FILE OPERATIONS
# ============================================================================

def read_file(key: str) -> Optional[str]:
    """Read text file from S3 or local filesystem"""
    if not USE_S3:
        local_path = os.path.join('data', key)
        if not os.path.exists(local_path):
            return None
        
        with open(local_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        response = s3.get_object(Bucket=bucket, Key=key)
        return response['Body'].read().decode('utf-8')
    
    except s3.exceptions.NoSuchKey:
        return None
    except Exception as e:
        print(f"⚠️ Error reading file from S3: {e}")
        return None


def write_file(key: str, content: str, content_type: str = 'text/plain'):
    """Write text file to S3 or local filesystem"""
    if not USE_S3:
        local_path = os.path.join('data', key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=content.encode('utf-8'),
            ContentType=content_type
        )
    
    except Exception as e:
        print(f"⚠️ Error writing file to S3: {e}")


def delete_file(key: str):
    """Delete file from S3 or local filesystem"""
    if not USE_S3:
        local_path = os.path.join('data', key)
        if os.path.exists(local_path):
            os.remove(local_path)
        return
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        s3.delete_object(Bucket=bucket, Key=key)
    
    except Exception as e:
        print(f"⚠️ Error deleting file from S3: {e}")


def file_exists(key: str) -> bool:
    """Check if file exists in S3 or local filesystem"""
    if not USE_S3:
        local_path = os.path.join('data', key)
        return os.path.exists(local_path)
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        s3.head_object(Bucket=bucket, Key=key)
        return True
    
    except s3.exceptions.ClientError:
        return False
    except Exception as e:
        print(f"⚠️ Error checking file existence in S3: {e}")
        return False


# ============================================================================
# INITIALIZATION
# ============================================================================

def init_s3():
    """Initialize S3 client (call once at startup)"""
    if USE_S3:
        try:
            s3 = get_s3_client()
            bucket = get_bucket_name()
            
            # Verify bucket exists
            s3.head_bucket(Bucket=bucket)
            print(f"✅ S3 bucket '{bucket}' connected")
        except Exception as e:
            print(f"⚠️ Error initializing S3: {e}")
    else:
        print("ℹ️ Using local file storage (development mode)")

