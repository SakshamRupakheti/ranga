CREATE TABLE ranga_thumbnail (project_id TEXT PRIMARY KEY REFERENCES ranga_project(id) ON DELETE CASCADE,data BLOB NOT NULL,revision TEXT NOT NULL);
ALTER TABLE ranga_comment ADD COLUMN anchor_x REAL;
ALTER TABLE ranga_comment ADD COLUMN anchor_y REAL;
