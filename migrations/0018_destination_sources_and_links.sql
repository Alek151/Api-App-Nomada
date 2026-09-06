ALTER TABLE destinations ADD COLUMN IF NOT EXISTS website_official text;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS wikipedia_url text;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS coordinates_source varchar(160);
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS history_source varchar(240);

UPDATE destinations
SET official_name = COALESCE(official_name, 'Parque Nacional Tikal'), municipality = COALESCE(municipality, 'Flores'),
    short_description = COALESCE(short_description, 'Una de las ciudades más importantes de la antigua civilización maya.'),
    history = COALESCE(history, 'Tikal fue uno de los principales centros políticos, económicos y militares del mundo maya durante el período Clásico.'),
    historical_period = COALESCE(historical_period, 'Civilización Maya'), approximate_date = COALESCE(approximate_date, 'Siglo IV a.C. - siglo X d.C.'),
    unesco_status = true, unesco_type = COALESCE(unesco_type, 'Mixto'), visit_duration_minutes = COALESCE(visit_duration_minutes, 300),
    website_official = COALESCE(website_official, 'https://whc.unesco.org/en/list/64'), wikipedia_url = COALESCE(wikipedia_url, 'https://es.wikipedia.org/wiki/Tikal'),
    coordinates_source = COALESCE(coordinates_source, 'OpenStreetMap'), history_source = COALESCE(history_source, 'Wikidata / Wikipedia / UNESCO'), updated_at = now()
WHERE slug IN ('tikal', 'parque-nacional-tikal');
