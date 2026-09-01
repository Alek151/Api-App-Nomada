-- Catálogo administrable de lugares, fotografías y sellos de Nómada.
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "activities" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "average_cost_min" integer;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "average_cost_max" integer;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "cost_currency" varchar(3) NOT NULL DEFAULT 'GTQ';
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "content_status" varchar(24) NOT NULL DEFAULT 'published';
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "human_verified_at" timestamp with time zone;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "human_verified_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "verification_notes" text;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "source_url" text;

CREATE TABLE IF NOT EXISTS "destination_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE cascade,
  "object_key" text NOT NULL,
  "caption" varchar(240),
  "position" integer NOT NULL DEFAULT 0,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "destination_photos_destination_idx" ON "destination_photos" ("destination_id");
CREATE UNIQUE INDEX IF NOT EXISTS "destination_photos_position_uq" ON "destination_photos" ("destination_id", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "stamps_destination_uq" ON "stamps" ("destination_id");

-- Datos iniciales de referencia: publicados para explorar, pero aún no marcados
-- como verificados por una persona. El administrador puede corregirlos o despublicarlos.
INSERT INTO "destinations" ("slug", "name", "department", "category", "description", "latitude", "longitude", "activities", "average_cost_min", "average_cost_max", "cost_currency", "content_status", "is_active", "metadata") VALUES
('antigua', 'Antigua Guatemala', 'Sacatepéquez', 'Historia', 'Calles coloniales, plazas, ruinas y gastronomía frente a los volcanes.', 14.5586, -90.7295, '["Cultura","A pie"]', 150, 450, 'GTQ', 'published', true, '{}'),
('acatenango', 'Volcán Acatenango', 'Chimaltenango', 'Volcanes', 'Ascenso de alta montaña con vistas hacia el complejo volcánico de Fuego.', 14.5013, -90.8764, '["A pie","Aventura"]', 350, 900, 'GTQ', 'published', true, '{}'),
('pacaya', 'Parque Nacional Volcán Pacaya', 'Escuintla', 'Volcanes', 'Senderos volcánicos y paisajes de lava en las faldas del Pacaya.', 14.3818, -90.6014, '["A pie","Aventura"]', 100, 350, 'GTQ', 'published', true, '{}'),
('hobbitenango', 'Hobbitenango', 'Sacatepéquez', 'Miradores', 'Miradores de montaña y senderos con panorámicas hacia Antigua y los volcanes.', 14.6115, -90.7496, '["A pie","Naturaleza"]', 100, 300, 'GTQ', 'published', true, '{}'),
('atitlan', 'Lago de Atitlán', 'Sololá', 'Agua', 'Lago rodeado de volcanes y pueblos con una identidad cultural viva.', 14.6907, -91.2025, '["Agua","Cultura"]', 150, 600, 'GTQ', 'published', true, '{}'),
('panajachel', 'Panajachel', 'Sololá', 'Agua', 'Puerta de entrada al lago, ideal para iniciar recorridos en lancha.', 14.7402, -91.1595, '["Agua","Cultura"]', 100, 350, 'GTQ', 'published', true, '{}'),
('san-juan-la-laguna', 'San Juan La Laguna', 'Sololá', 'Cultura', 'Murales, textiles y cooperativas comunitarias a orillas del lago.', 14.6932, -91.2877, '["Cultura","A pie","Agua"]', 100, 350, 'GTQ', 'published', true, '{}'),
('chichicastenango', 'Chichicastenango', 'Quiché', 'Cultura', 'Mercado tradicional y patrimonio vivo del altiplano guatemalteco.', 14.9435, -91.1111, '["Cultura","A pie"]', 75, 300, 'GTQ', 'published', true, '{}'),
('quetzaltenango', 'Quetzaltenango', 'Quetzaltenango', 'Cultura', 'Arquitectura urbana, cultura del altiplano y punto de partida para montañas cercanas.', 14.8347, -91.5180, '["Cultura","A pie"]', 100, 400, 'GTQ', 'published', true, '{}'),
('fuentes-georginas', 'Fuentes Georginas', 'Quetzaltenango', 'Bienestar', 'Aguas termales entre bosque nuboso cerca de Zunil.', 14.7434, -91.4901, '["Agua","Naturaleza"]', 100, 300, 'GTQ', 'published', true, '{}'),
('laguna-chicabal', 'Laguna Chicabal', 'Quetzaltenango', 'Naturaleza', 'Laguna de cráter y senderos de bosque con profundo valor cultural.', 14.7857, -91.6583, '["A pie","Naturaleza"]', 80, 250, 'GTQ', 'published', true, '{}'),
('tajumulco', 'Volcán Tajumulco', 'San Marcos', 'Volcanes', 'La cumbre más alta de Centroamérica, para montañistas preparados.', 15.0448, -91.9024, '["A pie","Aventura"]', 350, 1000, 'GTQ', 'published', true, '{}'),
('semuc', 'Semuc Champey', 'Alta Verapaz', 'Agua', 'Pozas turquesa y senderos sobre el río Cahabón.', 15.5333, -89.9608, '["Agua","Aventura","A pie"]', 200, 650, 'GTQ', 'published', true, '{}'),
('lanquin', 'Grutas de Lanquín', 'Alta Verapaz', 'Aventura', 'Sistema de cuevas y punto de conexión hacia Semuc Champey.', 15.5748, -89.9956, '["Aventura","Naturaleza"]', 100, 300, 'GTQ', 'published', true, '{}'),
('biotopo-quetzal', 'Biotopo del Quetzal', 'Baja Verapaz', 'Naturaleza', 'Bosque nuboso protegido, reconocido por su biodiversidad.', 15.2335, -90.1987, '["A pie","Naturaleza"]', 75, 250, 'GTQ', 'published', true, '{}'),
('coban', 'Cobán y Vivero Verapaz', 'Alta Verapaz', 'Naturaleza', 'Jardines, orquídeas y la atmósfera fresca del corazón de las Verapaces.', 15.4708, -90.3708, '["Naturaleza","Cultura"]', 75, 300, 'GTQ', 'published', true, '{}'),
('tikal', 'Tikal', 'Petén', 'Cultura maya', 'Templos mayas monumentales en la selva de la Reserva de la Biosfera Maya.', 17.2220, -89.6237, '["Cultura","A pie","Naturaleza"]', 250, 850, 'GTQ', 'published', true, '{}'),
('flores', 'Isla de Flores', 'Petén', 'Cultura', 'Isla colorida sobre el lago Petén Itzá, base para explorar el norte del país.', 16.9299, -89.8929, '["Cultura","Agua","A pie"]', 100, 350, 'GTQ', 'published', true, '{}'),
('yaxha', 'Parque Nacional Yaxhá-Nakum-Naranjo', 'Petén', 'Cultura maya', 'Ciudades mayas y vistas al lago Yaxhá entre selva tropical.', 17.0708, -89.1417, '["Cultura","A pie","Naturaleza"]', 200, 600, 'GTQ', 'published', true, '{}'),
('crater-azul', 'Crater Azul', 'Petén', 'Agua', 'Manantiales de agua clara y recorridos en lancha.', 16.2647, -90.3381, '["Agua","Naturaleza"]', 250, 700, 'GTQ', 'published', true, '{}'),
('rio-dulce', 'Parque Nacional Río Dulce', 'Izabal', 'Agua', 'Río, cañón, selva y vida caribeña en un corredor natural emblemático.', 15.6620, -89.0014, '["Agua","Naturaleza"]', 150, 500, 'GTQ', 'published', true, '{}'),
('livingston', 'Livingston', 'Izabal', 'Caribe', 'Cultura garífuna, Caribe y acceso por lancha desde Río Dulce o Puerto Barrios.', 15.8281, -88.7504, '["Agua","Cultura"]', 250, 800, 'GTQ', 'published', true, '{}'),
('playa-blanca', 'Playa Blanca', 'Izabal', 'Caribe', 'Playa caribeña de arena clara cercana a Punta de Manabique.', 15.9903, -88.7358, '["Agua","Naturaleza"]', 250, 750, 'GTQ', 'published', true, '{}'),
('quirigua', 'Parque Arqueológico Quiriguá', 'Izabal', 'Cultura maya', 'Estelas y esculturas mayas monumentales en el valle del Motagua.', 15.2757, -89.0395, '["Cultura","A pie"]', 125, 350, 'GTQ', 'published', true, '{}'),
('monterrico', 'Monterrico', 'Santa Rosa', 'Playa', 'Costa del Pacífico, playas de arena volcánica y ecosistemas de manglar.', 13.8994, -90.4880, '["Agua","Naturaleza"]', 150, 550, 'GTQ', 'published', true, '{}'),
('el-paredon', 'El Paredón', 'Escuintla', 'Playa', 'Surf, playa del Pacífico y atardeceres en una comunidad costera.', 13.9225, -90.7865, '["Agua","Aventura"]', 150, 500, 'GTQ', 'published', true, '{}'),
('iximche', 'Parque Arqueológico Iximché', 'Chimaltenango', 'Cultura maya', 'Antigua capital kaqchikel entre pinos y senderos del altiplano.', 14.7389, -90.9948, '["Cultura","A pie"]', 75, 250, 'GTQ', 'published', true, '{}'),
('takalik-abaj', 'Tak’alik Ab’aj', 'Retalhuleu', 'Cultura maya', 'Parque arqueológico que reúne historia maya y olmeca en la costa sur.', 14.5973, -91.7245, '["Cultura","A pie","Naturaleza"]', 125, 350, 'GTQ', 'published', true, '{}'),
('esquipulas', 'Basílica de Esquipulas', 'Chiquimula', 'Historia', 'Santuario de gran importancia cultural y religiosa en el oriente del país.', 14.5655, -89.3502, '["Cultura","A pie"]', 75, 300, 'GTQ', 'published', true, '{}'),
('bocas-polochic', 'Refugio de Vida Silvestre Bocas del Polochic', 'Izabal', 'Naturaleza', 'Humedales, aves y biodiversidad en la desembocadura del río Polochic.', 15.5459, -89.5665, '["Agua","Naturaleza"]', 150, 450, 'GTQ', 'published', true, '{}')
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name", "department" = EXCLUDED."department", "category" = EXCLUDED."category", "description" = EXCLUDED."description", "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude", "activities" = EXCLUDED."activities", "average_cost_min" = EXCLUDED."average_cost_min", "average_cost_max" = EXCLUDED."average_cost_max", "cost_currency" = EXCLUDED."cost_currency", "content_status" = EXCLUDED."content_status", "is_active" = EXCLUDED."is_active", "updated_at" = now();

INSERT INTO "stamps" ("destination_id", "code", "name", "description", "color", "is_active")
SELECT d."id", 'NMD-' || upper(replace(d."slug", '-', '_')), 'Sello · ' || d."name", 'Sello de exploración para ' || d."name", '#2F6D59', true
FROM "destinations" d
WHERE d."slug" IN ('antigua','acatenango','pacaya','hobbitenango','atitlan','panajachel','san-juan-la-laguna','chichicastenango','quetzaltenango','fuentes-georginas','laguna-chicabal','tajumulco','semuc','lanquin','biotopo-quetzal','coban','tikal','flores','yaxha','crater-azul','rio-dulce','livingston','playa-blanca','quirigua','monterrico','el-paredon','iximche','takalik-abaj','esquipulas','bocas-polochic')
ON CONFLICT ("destination_id") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "is_active" = true, "updated_at" = now();
