"""
Migration script: ChromaDB → Supabase pgvector
Run this once to migrate existing memory data
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()

import chromadb
from supabase import create_client
from openai import OpenAI

def migrate():
    print("🚀 Starting ChromaDB → Supabase migration...")
    
    # Connect to ChromaDB (local)
    chroma_client = chromadb.PersistentClient(path="data/chroma_db")
    
    # Connect to Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials in .env")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Create table in Supabase if not exists
    print("📝 Creating memory_embeddings table in Supabase...")
    
    # This SQL should be run in Supabase SQL editor first
    create_table_sql = """
    -- Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;
    
    -- Create memory embeddings table
    CREATE TABLE IF NOT EXISTS memory_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create index for vector similarity search
    CREATE INDEX IF NOT EXISTS memory_embeddings_embedding_idx 
    ON memory_embeddings USING ivfflat (embedding vector_cosine_ops);
    
    -- Create index for user queries
    CREATE INDEX IF NOT EXISTS memory_embeddings_user_id_idx 
    ON memory_embeddings(user_id);
    
    -- Create RPC function for vector search
    CREATE OR REPLACE FUNCTION match_memories(
        query_embedding vector(1536),
        match_count int,
        filter_user_id uuid
    )
    RETURNS TABLE (
        id uuid,
        content text,
        metadata jsonb,
        similarity float
    )
    LANGUAGE sql STABLE
    AS $$
        SELECT
            id,
            content,
            metadata,
            1 - (embedding <=> query_embedding) as similarity
        FROM memory_embeddings
        WHERE user_id = filter_user_id
        ORDER BY embedding <=> query_embedding
        LIMIT match_count;
    $$;
    """
    
    print("⚠️  Please run this SQL in Supabase SQL Editor:")
    print("-" * 60)
    print(create_table_sql)
    print("-" * 60)
    print("\nPress Enter after running the SQL to continue...")
    input()
    
    # Get all collections from ChromaDB
    try:
        collections = chroma_client.list_collections()
        print(f"📦 Found {len(collections)} collections in ChromaDB")
    except Exception as e:
        print(f"❌ Error accessing ChromaDB: {e}")
        print("ℹ️  No data to migrate (this is OK for new installations)")
        return
    
    total_migrated = 0
    
    for collection in collections:
        collection_name = collection.name
        print(f"\n📦 Processing collection: {collection_name}")
        
        # Get all data from collection
        try:
            data = collection.get(include=["embeddings", "documents", "metadatas"])
            
            ids = data.get("ids", [])
            embeddings = data.get("embeddings", [])
            documents = data.get("documents", [])
            metadatas = data.get("metadatas", [])
            
            print(f"   Found {len(ids)} memories")
            
            # Migrate each memory
            for i, doc_id in enumerate(ids):
                content = documents[i] if i < len(documents) else ""
                embedding = embeddings[i] if i < len(embeddings) else None
                metadata = metadatas[i] if i < len(metadatas) else {}
                
                # Extract user_id from metadata or collection name
                user_id = metadata.get("user_id") or metadata.get("userId")
                
                if not user_id:
                    # Try to parse from collection name (if format is user_memories_<uuid>)
                    if "user_memories_" in collection_name:
                        user_id = collection_name.split("user_memories_")[1]
                    else:
                        print(f"   ⚠️  Skipping memory without user_id: {doc_id}")
                        continue
                
                if not embedding:
                    print(f"   ⚠️  Skipping memory without embedding: {doc_id}")
                    continue
                
                # Insert into Supabase
                try:
                    supabase.table("memory_embeddings").insert({
                        "user_id": user_id,
                        "content": content,
                        "embedding": embedding,
                        "metadata": {
                            "chroma_id": doc_id,
                            "collection": collection_name,
                            **metadata
                        }
                    }).execute()
                    
                    total_migrated += 1
                    
                    if total_migrated % 10 == 0:
                        print(f"   ✅ Migrated {total_migrated} memories...")
                
                except Exception as e:
                    print(f"   ❌ Error migrating {doc_id}: {e}")
        
        except Exception as e:
            print(f"   ❌ Error processing collection: {e}")
    
    print(f"\n✨ Migration complete! Migrated {total_migrated} memories to Supabase")
    print(f"💾 Original ChromaDB data is still in data/chroma_db/ (you can delete it later)")


if __name__ == "__main__":
    migrate()

