-- PostGIS no viene activado en Neon. En el Docker local ya lo está, de ahí el IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS postgis;
