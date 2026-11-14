ALTER TABLE astronauts ADD COLUMN age_years INTEGER;
ALTER TABLE mission_configuration ADD COLUMN met_paused INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mission_configuration ADD COLUMN met_frozen_seconds INTEGER NOT NULL DEFAULT 0;
