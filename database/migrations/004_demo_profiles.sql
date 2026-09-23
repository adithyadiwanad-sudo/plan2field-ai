-- Additive profile metadata; project membership remains the RBAC authority.
ALTER TABLE users ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'GENERAL';
