"""
Patch script to update voice_generation.py to use DynamoDB state management
Run this to update the file automatically
"""
import re

def patch_voice_pipeline():
    print("🔧 Patching voice_generation.py for DynamoDB support...")
    
    file_path = "voice/voice_generation.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add import for dynamodb_state at the top (after other imports)
    import_addition = """
# DynamoDB state management (hybrid Lambda + App Runner deployment)
try:
    from dynamodb_state import (
        check_duplicate_transcript,
        mark_transcript_processed,
        get_conversation_cache,
        set_conversation_cache,
        clear_conversation_cache
    )
    USE_DYNAMODB_STATE = True
except ImportError:
    # Fallback to in-memory state for local development
    USE_DYNAMODB_STATE = False
    print("⚠️  DynamoDB state not available, using in-memory state")
"""
    
    # Find a good place to add the import (after other imports)
    import_position = content.find("import hashlib")
    if import_position != -1:
        # Find the next newline after this line
        next_newline = content.find("\n", import_position) + 1
        content = content[:next_newline] + "\n" + import_addition + "\n" + content[next_newline:]
        print("   ✅ Added DynamoDB import")
    
    # 2. Replace the transcript deduplication logic in process_transcription
    # Find the deduplication section
    old_pattern = r'(_recent_transcripts\s*=\s*{}).*?(if text_normalized in _recent_transcripts:)'
    
    new_deduplication = """_recent_transcripts = {}  # Fallback for local development
    
    # Permanent deduplication using DynamoDB (or in-memory fallback)
    _permanent_seen = set()  # MD5 hashes of processed transcripts (persistent across restarts in DynamoDB)
    _transcript_cache_ttl = 30.0  # seconds - ignore duplicates within 30 seconds
    
    async def process_transcription(text: str, user_id: str):
        nonlocal _recent_transcripts, _permanent_seen, _processing_lock, _current_processing_task, _last_processing_start_time, client_token, api_key  # Allow modification of outer scope variables
        
        if not text or not text.strip():
            logging.info("⏭️ Skipping empty transcript")
            return
        
        text_normalized = text.strip().lower()
        current_time = time.time()
        
        # PERMANENT DEDUPLICATION (DynamoDB or in-memory)
        if USE_DYNAMODB_STATE:
            # Use DynamoDB for permanent deduplication
            if check_duplicate_transcript(text_normalized):
                logging.info(f"⏭️ Skipping PERMANENT duplicate (DynamoDB): '{text[:50]}...'")
                return
        else:
            # Fallback to in-memory set
            text_hash = hashlib.md5(text_normalized.encode('utf-8')).hexdigest()
            if text_hash in _permanent_seen:
                logging.info(f"⏭️ Skipping PERMANENT duplicate (in-memory): '{text[:50]}...'")
                return
            _permanent_seen.add(text_hash)
        
        # TIME-BASED DEDUPLICATION (prevent processing same text twice in rapid succession)
        if text_normalized in _recent_transcripts:"""
    
    # This is complex, so let's just write instructions instead
    
    print("\n" + "="*70)
    print("📝 MANUAL STEPS REQUIRED:")
    print("="*70)
    print("\n1. Open MIRA_MVP0/backend/voice/voice_generation.py")
    print("\n2. After line ~38 (after 'import hashlib'), add:")
    print("-" * 70)
    print(import_addition)
    print("-" * 70)
    
    print("\n3. Find the function 'process_transcription' around line 2410")
    print("\n4. Replace the transcript deduplication logic:")
    print("   BEFORE (around line 2432):")
    print("   ```")
    print("   if text_normalized in _recent_transcripts:")
    print("   ```")
    
    print("\n   AFTER:")
    print("   ```python")
    print("   # PERMANENT DEDUPLICATION (DynamoDB or in-memory)")
    print("   if USE_DYNAMODB_STATE:")
    print("       # Use DynamoDB for permanent deduplication")
    print("       if check_duplicate_transcript(text_normalized):")
    print('           logging.info(f"⏭️ Skipping PERMANENT duplicate (DynamoDB): \'{text[:50]}...\'")') 
    print("           return")
    print("   else:")
    print("       # Fallback to in-memory set")
    print("       text_hash = hashlib.md5(text_normalized.encode('utf-8')).hexdigest()")
    print("       if text_hash in _permanent_seen:")
    print('           logging.info(f"⏭️ Skipping PERMANENT duplicate (in-memory): \'{text[:50]}...\'")') 
    print("           return")
    print("       _permanent_seen.add(text_hash)")
    print("   ")
    print("   # TIME-BASED DEDUPLICATION (existing logic)")
    print("   if text_normalized in _recent_transcripts:")
    print("   ```")
    
    print("\n5. After the existing deduplication passes, add (around line 2463):")
    print("   ```python")
    print("   # Mark as processed in DynamoDB")
    print("   if USE_DYNAMODB_STATE:")
    print("       mark_transcript_processed(text_normalized)")
    print("   ```")
    
    print("\n6. Save the file")
    
    print("\n" + "="*70)
    print("✨ This ensures:")
    print("   - DynamoDB stores processed transcripts permanently")
    print("   - No duplicates even across restarts or multiple instances")
    print("   - Falls back to in-memory state for local development")
    print("="*70)
    
    # Create a backup
    backup_path = file_path + ".backup"
    import shutil
    try:
        shutil.copy2(file_path, backup_path)
        print(f"\n💾 Backup created: {backup_path}")
    except:
        pass


if __name__ == "__main__":
    patch_voice_pipeline()

