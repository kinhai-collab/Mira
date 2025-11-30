"""
Migration script: Local files → S3
Run this once to migrate existing local files
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()

from s3_storage import get_s3_client, get_bucket_name
import glob

def migrate():
    print("🚀 Starting local files → S3 migration...")
    
    # Set environment to use S3
    os.environ['USE_S3'] = 'true'
    
    try:
        s3 = get_s3_client()
        bucket = get_bucket_name()
        
        # Verify bucket exists
        s3.head_bucket(Bucket=bucket)
        print(f"✅ Connected to S3 bucket: {bucket}")
    except Exception as e:
        print(f"❌ Error connecting to S3: {e}")
        print("ℹ️  Make sure you've deployed DynamoDB/S3 infrastructure first:")
        print("    serverless deploy -c serverless_hybrid.yml --stage dev")
        sys.exit(1)
    
    # Files to migrate
    files_to_migrate = [
        "data/autopilot/autopilot_audit.jsonl",
        # Add more files here if needed
    ]
    
    total_migrated = 0
    total_size = 0
    
    for local_path in files_to_migrate:
        if not os.path.exists(local_path):
            print(f"⚠️  File not found: {local_path}")
            continue
        
        # Get file size
        size = os.path.getsize(local_path)
        total_size += size
        
        # S3 key (remove 'data/' prefix)
        s3_key = local_path.replace("data/", "", 1)
        
        print(f"\n📤 Uploading: {local_path} → s3://{bucket}/{s3_key}")
        print(f"   Size: {size:,} bytes")
        
        try:
            with open(local_path, 'rb') as f:
                content = f.read()
            
            # Determine content type
            content_type = 'text/plain'
            if local_path.endswith('.json'):
                content_type = 'application/json'
            elif local_path.endswith('.jsonl'):
                content_type = 'application/jsonl'
            elif local_path.endswith('.mp3'):
                content_type = 'audio/mpeg'
            elif local_path.endswith('.wav'):
                content_type = 'audio/wav'
            
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=content,
                ContentType=content_type
            )
            
            total_migrated += 1
            print(f"   ✅ Uploaded successfully")
        
        except Exception as e:
            print(f"   ❌ Error uploading: {e}")
    
    # Also migrate speech files if they exist
    speech_dir = "speech"
    if os.path.exists(speech_dir):
        print(f"\n📦 Migrating speech files from {speech_dir}/...")
        
        for filename in os.listdir(speech_dir):
            if filename.endswith(('.mp3', '.wav')):
                local_path = os.path.join(speech_dir, filename)
                s3_key = f"speech/{filename}"
                
                try:
                    size = os.path.getsize(local_path)
                    total_size += size
                    
                    with open(local_path, 'rb') as f:
                        content = f.read()
                    
                    content_type = 'audio/mpeg' if filename.endswith('.mp3') else 'audio/wav'
                    
                    s3.put_object(
                        Bucket=bucket,
                        Key=s3_key,
                        Body=content,
                        ContentType=content_type
                    )
                    
                    total_migrated += 1
                    print(f"   ✅ {filename} ({size:,} bytes)")
                
                except Exception as e:
                    print(f"   ❌ Error uploading {filename}: {e}")
    
    print(f"\n✨ Migration complete!")
    print(f"   📁 Files migrated: {total_migrated}")
    print(f"   💾 Total size: {total_size:,} bytes ({total_size / (1024*1024):.2f} MB)")
    print(f"   🪣 S3 bucket: {bucket}")
    print(f"\n💡 You can now delete local files (they're backed up in S3):")
    for path in files_to_migrate:
        if os.path.exists(path):
            print(f"   rm {path}")


if __name__ == "__main__":
    migrate()

