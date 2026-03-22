ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE TABLE IF NOT EXISTS usda_land_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  county text NOT NULL,
  year integer NOT NULL,
  cropland_value_per_acre numeric,
  pastureland_value_per_acre numeric,
  all_land_value_per_acre numeric,
  cash_rent_cropland numeric,
  cash_rent_pasture numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(state, county, year)
);

CREATE TABLE IF NOT EXISTS weather_alerts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  alerts jsonb NOT NULL DEFAULT '[]',
  conditions jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_asset ON weather_alerts_cache(asset_id);
CREATE INDEX IF NOT EXISTS idx_usda_land_values_lookup ON usda_land_values(state, county, year);

ALTER TABLE usda_land_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_alerts_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_usda" ON usda_land_values FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read_weather" ON weather_alerts_cache FOR SELECT USING (auth.uid() IS NOT NULL);
