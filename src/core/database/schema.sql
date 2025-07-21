-- Aha MCP Server Database Schema
-- SQLite with sqlite-vec extension for vector embeddings

-- Enable sqlite-vec extension for vector operations
-- .load sqlite-vec

-- ===================================
-- SYNC METADATA TABLES
-- ===================================

CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed
    entities TEXT NOT NULL, -- JSON array of entity types to sync
    progress INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 100,
    current_entity TEXT,
    current_entity_progress INTEGER DEFAULT 0,
    current_entity_total INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    started_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    estimated_completion DATETIME,
    configuration TEXT -- JSON configuration for this sync job
);

CREATE TABLE IF NOT EXISTS sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL, -- sync_start, sync_complete, sync_error, entity_processed
    details TEXT, -- JSON details about the action
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES sync_jobs(id)
);

CREATE TABLE IF NOT EXISTS sync_status (
    entity_type TEXT PRIMARY KEY,
    last_sync_at DATETIME,
    last_successful_sync_at DATETIME,
    total_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    next_sync_at DATETIME,
    sync_enabled BOOLEAN DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===================================
-- AHA ENTITY TABLES
-- ===================================

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_prefix TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT, -- JSON of full API response
    -- Vector embedding for semantic search
    name_embedding BLOB,
    description_embedding BLOB
);

CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_num TEXT,
    feature_type TEXT,
    workflow_status TEXT,
    progress REAL,
    score REAL,
    product_id TEXT,
    release_id TEXT,
    epic_id TEXT,
    assigned_to_user_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT, -- JSON of full API response
    -- Vector embeddings for semantic search
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB, -- name + description + context
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_num TEXT,
    workflow_status TEXT,
    category TEXT,
    score REAL,
    product_id TEXT,
    created_by_user_id TEXT,
    promoted_to_feature_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS epics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_num TEXT,
    workflow_status TEXT,
    progress REAL,
    product_id TEXT,
    release_id TEXT,
    initiative_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS initiatives (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_num TEXT,
    workflow_status TEXT,
    progress REAL,
    product_id TEXT,
    assigned_to_user_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT
);

CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    reference_num TEXT,
    workflow_status TEXT,
    start_date DATE,
    release_date DATE,
    product_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    progress REAL,
    product_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    name_embedding BLOB,
    description_embedding BLOB,
    combined_embedding BLOB,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- feature, idea, epic, etc.
    entity_id TEXT NOT NULL,
    user_id TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    -- Vector embeddings
    body_embedding BLOB,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ===================================
-- RELATIONSHIP TABLES
-- ===================================

CREATE TABLE IF NOT EXISTS feature_goals (
    feature_id TEXT,
    goal_id TEXT,
    PRIMARY KEY (feature_id, goal_id),
    FOREIGN KEY (feature_id) REFERENCES features(id),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
);

CREATE TABLE IF NOT EXISTS feature_tags (
    feature_id TEXT,
    tag TEXT,
    PRIMARY KEY (feature_id, tag),
    FOREIGN KEY (feature_id) REFERENCES features(id)
);

-- ===================================
-- SEARCH AND EMBEDDING TABLES
-- ===================================

CREATE TABLE IF NOT EXISTS embedding_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed
    entities TEXT NOT NULL, -- JSON array of entity types to process
    progress INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 100,
    current_entity TEXT,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    options TEXT, -- JSON embedding options
    started_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    estimated_completion DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    text TEXT NOT NULL, -- The text that was embedded
    embedding_vector TEXT NOT NULL, -- JSON array of the embedding vector
    metadata TEXT, -- JSON metadata about the embedding
    model TEXT DEFAULT 'simple-hash', -- Embedding model used
    dimensions INTEGER DEFAULT 384,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS embedding_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL, -- name, description, combined, etc.
    embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    dimensions INTEGER NOT NULL DEFAULT 384,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, field_name)
);

-- Search cache for performance
CREATE TABLE IF NOT EXISTS search_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT UNIQUE NOT NULL,
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL, -- semantic, exact, hybrid
    results TEXT NOT NULL, -- JSON results
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================

-- Sync tables indexes
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_updated_at ON sync_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_history_job_id ON sync_history(job_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_timestamp ON sync_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_status_entity_type ON sync_status(entity_type);

-- Entity table indexes
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_features_product_id ON features(product_id);
CREATE INDEX IF NOT EXISTS idx_features_updated_at ON features(updated_at);
CREATE INDEX IF NOT EXISTS idx_features_assigned_to_user_id ON features(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_product_id ON ideas(product_id);
CREATE INDEX IF NOT EXISTS idx_ideas_updated_at ON ideas(updated_at);
CREATE INDEX IF NOT EXISTS idx_epics_product_id ON epics(product_id);
CREATE INDEX IF NOT EXISTS idx_epics_updated_at ON epics(updated_at);
CREATE INDEX IF NOT EXISTS idx_initiatives_product_id ON initiatives(product_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_updated_at ON initiatives(updated_at);
CREATE INDEX IF NOT EXISTS idx_releases_product_id ON releases(product_id);
CREATE INDEX IF NOT EXISTS idx_releases_updated_at ON releases(updated_at);
CREATE INDEX IF NOT EXISTS idx_goals_product_id ON goals(product_id);
CREATE INDEX IF NOT EXISTS idx_goals_updated_at ON goals(updated_at);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_updated_at ON comments(updated_at);

-- Search and embedding indexes
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_updated_at ON embedding_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity_type ON embeddings(entity_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_entity ON embedding_metadata(entity_type, entity_id);

-- ===================================
-- CONFIGURATION TABLE
-- ===================================

CREATE TABLE IF NOT EXISTS server_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT OR IGNORE INTO server_config (key, value, description) VALUES
('sync_interval_minutes', '30', 'Default sync interval in minutes'),
('max_concurrent_syncs', '3', 'Maximum number of concurrent sync operations'),
('embedding_batch_size', '50', 'Number of items to process in embedding batch'),
('cache_ttl_minutes', '60', 'Cache time-to-live in minutes'),
('enable_semantic_search', 'true', 'Enable semantic search capabilities'),
('embedding_model', 'all-MiniLM-L6-v2', 'Default embedding model to use'),
('max_search_results', '100', 'Maximum number of search results to return'),
('enable_background_sync', 'true', 'Enable automatic background synchronization');

-- ===================================
-- VIEWS FOR COMMON QUERIES
-- ===================================

CREATE VIEW IF NOT EXISTS entity_sync_status AS
SELECT 
    'features' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN synced_at > datetime('now', '-1 day') THEN 1 END) as recently_synced,
    MAX(synced_at) as last_sync
FROM features
UNION ALL
SELECT 
    'ideas' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN synced_at > datetime('now', '-1 day') THEN 1 END) as recently_synced,
    MAX(synced_at) as last_sync
FROM ideas
UNION ALL
SELECT 
    'epics' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN synced_at > datetime('now', '-1 day') THEN 1 END) as recently_synced,
    MAX(synced_at) as last_sync
FROM epics
UNION ALL
SELECT 
    'initiatives' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN synced_at > datetime('now', '-1 day') THEN 1 END) as recently_synced,
    MAX(synced_at) as last_sync
FROM initiatives
UNION ALL
SELECT 
    'products' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN synced_at > datetime('now', '-1 day') THEN 1 END) as recently_synced,
    MAX(synced_at) as last_sync
FROM products;