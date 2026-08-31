INSERT INTO destinations (id, slug, name, department, category, description, latitude, longitude, validation_radius_meters, points)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'tikal', 'Tikal', 'Petén', 'Cultura maya', 'Templos milenarios entre la selva tropical.', 17.2220, -89.6237, 650, 150),
  ('10000000-0000-4000-8000-000000000002', 'lago-atitlan', 'Lago de Atitlán', 'Sololá', 'Naturaleza', 'Pueblos, volcanes y cultura viva alrededor del lago.', 14.6907, -91.2025, 1000, 120),
  ('10000000-0000-4000-8000-000000000003', 'semuc-champey', 'Semuc Champey', 'Alta Verapaz', 'Aventura', 'Pozas turquesa y senderos sobre el río Cahabón.', 15.5333, -89.9608, 650, 140),
  ('10000000-0000-4000-8000-000000000004', 'antigua-guatemala', 'Antigua Guatemala', 'Sacatepéquez', 'Historia', 'Arquitectura colonial, volcanes y gastronomía.', 14.5586, -90.7295, 1200, 100)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO stamps (destination_id, code, name, description, color)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'TIKAL-MAYA', 'Corazón del Mundo Maya', 'Sello oficial de visita a Tikal.', '#2F6D59'),
  ('10000000-0000-4000-8000-000000000002', 'ATITLAN-VOLCANES', 'Entre volcanes', 'Sello oficial de visita al Lago de Atitlán.', '#287B87'),
  ('10000000-0000-4000-8000-000000000003', 'SEMUCH-AGUA', 'Agua escondida', 'Sello oficial de visita a Semuc Champey.', '#39775C'),
  ('10000000-0000-4000-8000-000000000004', 'ANTIGUA-PATRIMONIO', 'Ciudad Patrimonio', 'Sello oficial de visita a Antigua Guatemala.', '#B0673C')
ON CONFLICT (code) DO NOTHING;

INSERT INTO badges (code, name, description, requirement)
VALUES
  ('RUTA-MAYA', 'Ruta Maya', 'Completa tres destinos de cultura maya.', '{"category":"Cultura maya","count":3}'),
  ('GUATE-VERDE', 'Guatemala Verde', 'Completa cinco destinos naturales.', '{"category":"Naturaleza","count":5}'),
  ('PRIMERA-HUELLA', 'Primera Huella', 'Valida tu primera visita.', '{"visits":1}')
ON CONFLICT (code) DO NOTHING;
