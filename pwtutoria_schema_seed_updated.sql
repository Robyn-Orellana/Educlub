
-- Proyecto PW - Plataforma de Tutoría Académica
-- SQL actualizado (sin cursos de prueba; con 50 cursos oficiales del pensum)
-- Incluye ON DELETE CASCADE en relaciones con courses.*
-- Compatible con Neon (PostgreSQL 15+)

BEGIN;

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================
-- 1) Esquema (DDL)
-- =======================

-- Roles y usuarios
CREATE TABLE IF NOT EXISTS roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('admin','tutor','student'))
);

CREATE TABLE IF NOT EXISTS users (
  id bigserial PRIMARY KEY,
  role_id int NOT NULL REFERENCES roles(id),
  first_name text NOT NULL,
  last_name  text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cursos, matrículas y asignación de tutores
CREATE TABLE IF NOT EXISTS courses (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS tutor_courses (
  id bigserial PRIMARY KEY,
  tutor_id bigint NOT NULL REFERENCES users(id),
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, course_id)
);

-- Materiales
CREATE TABLE IF NOT EXISTS materials (
  id bigserial PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('pdf','video','slide','other')),
  storage_url text NOT NULL,
  uploaded_by bigint NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Sesiones y reservas (transacciones)
CREATE TABLE IF NOT EXISTS tutoring_sessions (
  id bigserial PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tutor_id bigint NOT NULL REFERENCES users(id),
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL CHECK (duration_min BETWEEN 15 AND 240),
  platform text NOT NULL CHECK (platform IN ('meet','zoom','webrtc')),
  join_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','canceled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users(id),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','attended','no_show','canceled')),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id bigserial PRIMARY KEY,
  reservation_id bigint NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  check_in_at timestamptz,
  check_out_at timestamptz
);

-- Feedback/Calificaciones
CREATE TABLE IF NOT EXISTS ratings (
  id bigserial PRIMARY KEY,
  reservation_id bigint NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  rater_id bigint NOT NULL REFERENCES users(id),
  tutor_id bigint NOT NULL REFERENCES users(id),
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foros
CREATE TABLE IF NOT EXISTS forums (
  id bigserial PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id bigserial PRIMARY KEY,
  forum_id bigint NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  parent_post_id bigint REFERENCES posts(id),
  author_id bigint NOT NULL REFERENCES users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notificaciones + bitácora
CREATE TABLE IF NOT EXISTS notifications (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id bigint NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sessions_course_time ON tutoring_sessions(course_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reservations_session ON reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_reservations_student ON reservations(student_id);
CREATE INDEX IF NOT EXISTS idx_ratings_tutor ON ratings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_posts_forum_time ON posts(forum_id, created_at);

-- =======================
-- 2) Datos iniciales (Seeds)
-- =======================

INSERT INTO roles(name) VALUES ('admin'),('tutor'),('student')
ON CONFLICT DO NOTHING;

-- Usuarios base
INSERT INTO users(role_id, first_name, last_name, email, password_hash)
SELECT r.id, x.fn, x.ln, x.em, 'hash'
FROM (VALUES
 ('tutor','Ana','López','ana.tutor@umg.edu'),
 ('tutor','Diego','Martínez','diego.tutor@umg.edu'),
 ('student','María','García','maria@umg.edu'),
 ('student','José','Ramírez','jose@umg.edu'),
 ('admin','Robyn','Orellana','admin@umg.edu')
) AS x(rt, fn, ln, em)
JOIN roles r ON r.name = x.rt
ON CONFLICT (email) DO NOTHING;

-- 50 cursos oficiales (pensum)
INSERT INTO courses(code, name, description) VALUES
('090001','Desarrollo Humano y Profesional','Formación integral y desarrollo personal.'),
('090002','Metodología de la Investigación','Técnicas de investigación científica aplicadas.'),
('090003','Contabilidad I','Fundamentos de contabilidad financiera.'),
('090004','Introducción a los Sistemas de Cómputo','Conceptos básicos de computación y laboratorio de cómputo.'),
('090005','Lógica de Sistemas','Pensamiento lógico y resolución de problemas.'),
('090006','Precálculo','Conceptos matemáticos previos al cálculo.'),
('090007','Álgebra Lineal','Vectores, matrices y sistemas de ecuaciones.'),
('090008','Algoritmos','Diseño y análisis de algoritmos, con laboratorio de cómputo.'),
('090009','Contabilidad II','Continuación de Contabilidad I, registros contables.'),
('090010','Matemática Discreta','Lógica, conjuntos, combinatoria y grafos.'),
('090011','Física I','Fundamentos de mecánica clásica.'),
('090012','Programación I','Introducción a la programación estructurada, con laboratorio.'),
('090013','Cálculo I','Funciones, límites y derivadas.'),
('090014','Proceso Administrativo','Principios básicos de administración.'),
('090015','Derecho Informático','Aspectos legales de la informática.'),
('090016','Microeconomía','Análisis económico básico y comportamiento del consumidor.'),
('090017','Programación II','Programación orientada a objetos, con laboratorio.'),
('090018','Cálculo II','Integrales y aplicaciones.'),
('090019','Estadística I','Introducción a la estadística descriptiva.'),
('090020','Física II','Electricidad y magnetismo, laboratorio de física.'),
('090021','Métodos Numéricos','Soluciones numéricas a problemas matemáticos.'),
('090022','Programación III','Estructuras avanzadas y diseño modular, con laboratorio.'),
('090023','Emprendedores de Negocios','Creación y gestión de nuevas empresas.'),
('090024','Electrónica Analógica','Circuitos analógicos, laboratorio de electrónica.'),
('090025','Estadística II','Inferencia estadística y análisis de regresión.'),
('090026','Investigación de Operaciones','Modelos de optimización y toma de decisiones.'),
('090027','Bases de Datos I','Modelado y lenguaje SQL, laboratorio de cómputo.'),
('090028','Autómatas y Lenguajes Formales','Teoría de autómatas y gramáticas.'),
('090029','Sistemas Operativos I','Estructura de sistemas operativos, laboratorio de SO.'),
('090030','Electrónica Digital','Diseño digital y sistemas lógicos, laboratorio.'),
('090031','Bases de Datos II','Administración y optimización de bases de datos, laboratorio.'),
('090032','Análisis de Sistemas I','Modelado de procesos y requerimientos.'),
('090033','Sistemas Operativos II','Gestión avanzada de sistemas, laboratorio.'),
('090034','Arquitectura de Computadoras I','Estructura y funcionamiento del hardware, laboratorio.'),
('090035','Compiladores','Diseño de compiladores y lenguajes formales.'),
('090036','Desarrollo Web','Diseño y desarrollo de aplicaciones web, laboratorio.'),
('090037','Análisis de Sistemas II','Diseño estructurado y documentación técnica.'),
('090038','Redes de Computadoras I','Conceptos básicos de redes, laboratorio de redes.'),
('090039','Ética Profesional','Valores y responsabilidad profesional.'),
('090040','Arquitectura de Computadoras II','Procesadores y arquitecturas avanzadas, laboratorio.'),
('090041','Administración de Tecnologías de Información','Gestión y control de recursos tecnológicos.'),
('090042','Ingeniería de Software','Ciclo de vida, metodologías y documentación de software.'),
('090043','Proyecto de Graduación I','Primera fase del proyecto de titulación.'),
('090044','Redes de Computadoras II','Protocolos y enrutamiento avanzado, laboratorio de redes.'),
('090045','Inteligencia Artificial','Fundamentos de IA y aplicaciones prácticas.'),
('090046','Telecomunicaciones','Sistemas de comunicación y transmisión de datos, laboratorio.'),
('090047','Seminario de Tecnologías de Información','Análisis de tendencias y temas tecnológicos.'),
('090048','Aseguramiento de la Calidad de Software','Pruebas, métricas y control de calidad.'),
('090049','Proyecto de Graduación II','Segunda fase y presentación final del proyecto.'),
('090050','Seguridad y Auditoría de Sistemas','Seguridad informática y auditoría, laboratorio.')
ON CONFLICT (code) DO NOTHING;

-- Asignación de tutores a cursos clave del pensum
INSERT INTO tutor_courses(tutor_id, course_id)
SELECT u.id, c.id
FROM users u
JOIN courses c ON c.code IN ('090012','090017','090022','090027','090031','090036','090038','090044')
WHERE u.email IN ('ana.tutor@umg.edu','diego.tutor@umg.edu')
ON CONFLICT DO NOTHING;

-- Matricular estudiantes en un subconjunto representativo
INSERT INTO enrollments(user_id, course_id)
SELECT u.id, c.id
FROM users u
JOIN courses c ON c.code IN ('090012','090017','090027','090031','090036','090038','090042','090048')
WHERE u.role_id = (SELECT id FROM roles WHERE name='student')
ON CONFLICT DO NOTHING;

-- =======================
-- 3) Sesiones futuras y reservas (solo con cursos reales)
-- =======================

-- Crear sesiones próximas (hoy + próximos 7 días, cada 6h) para cursos del área de programación/bd/web/redes
INSERT INTO tutoring_sessions(course_id, tutor_id, scheduled_at, duration_min, platform, join_url)
SELECT c.id, u.id, now() + (g || ' hours')::interval, 60,
       (ARRAY['meet','zoom','webrtc'])[1 + (random()*2)::int],
       'https://meet.example/' || gen_random_uuid()
FROM generate_series(2, 168, 6) g
JOIN courses c ON c.code IN ('090012','090017','090022','090027','090031','090036','090038','090044')
JOIN users u ON u.email IN ('ana.tutor@umg.edu','diego.tutor@umg.edu');

-- Reservas de estudiantes (~65% de ocupación)
INSERT INTO reservations(session_id, student_id)
SELECT s.id, u.id
FROM tutoring_sessions s
JOIN users u ON u.role_id = (SELECT id FROM roles WHERE name='student')
WHERE s.scheduled_at > now() AND (random() < 0.65)
ON CONFLICT DO NOTHING;

-- =======================
-- 4) Historial reciente (últimos 30 días, cada 8h) con cursos reales
-- =======================

INSERT INTO tutoring_sessions(course_id, tutor_id, scheduled_at, duration_min, platform, join_url, status)
SELECT c.id, t.id, now() - (g || ' hours')::interval, 60,
       (ARRAY['meet','zoom','webrtc'])[1 + (random()*2)::int],
       'https://meet.example/' || gen_random_uuid(),
       'completed'
FROM generate_series(8, 30*24, 8) g
JOIN courses c ON c.code IN ('090012','090017','090022','090027','090031','090036','090038','090044')
JOIN users t ON t.role_id = (SELECT id FROM roles WHERE name='tutor');

-- Reservas históricas (40% de sesiones por estudiante; 85% attended)
INSERT INTO reservations(session_id, student_id, reserved_at, status)
SELECT s.id, u.id, s.scheduled_at - interval '1 day',
       CASE WHEN random()<0.85 THEN 'attended' ELSE 'no_show' END
FROM tutoring_sessions s
JOIN users u ON u.role_id = (SELECT id FROM roles WHERE name='student')
WHERE s.status='completed' AND random()<0.40
ON CONFLICT DO NOTHING;

-- Asistencias
INSERT INTO attendance(reservation_id, check_in_at, check_out_at)
SELECT r.id, s.scheduled_at, s.scheduled_at + (s.duration_min || ' minutes')::interval
FROM reservations r
JOIN tutoring_sessions s ON s.id = r.session_id
WHERE r.status='attended'
ON CONFLICT DO NOTHING;

-- Calificaciones
INSERT INTO ratings(reservation_id, rater_id, tutor_id, course_id, stars, comment)
SELECT r.id, r.student_id, s.tutor_id, s.course_id,
       3 + (random()*2)::int,
       (ARRAY['Muy útil','Claro y concreto','Podría mejorar el ritmo','Excelente explicación'])[1+(random()*3)::int]
FROM reservations r
JOIN tutoring_sessions s ON s.id = r.session_id
WHERE r.status='attended'
ON CONFLICT DO NOTHING;

-- Foros y publicaciones
INSERT INTO forums(course_id, title, created_by)
SELECT id, 'Foro del curso', (SELECT id FROM users WHERE email='admin@umg.edu')
FROM courses
ON CONFLICT DO NOTHING;

INSERT INTO posts(forum_id, author_id, content, created_at)
SELECT f.id,
       u.id,
       'Duda sobre el tema ' || to_char(now() - (g||' hours')::interval,'YYYY-MM-DD HH24:MI'),
       now() - (g||' hours')::interval
FROM forums f
JOIN users u ON u.role_id IN (SELECT id FROM roles WHERE name IN ('student','tutor'))
JOIN generate_series(1, 24*15, 6) g ON TRUE;

-- =======================
-- 5) Triggers de bitácora
-- =======================

CREATE OR REPLACE FUNCTION log_activity() RETURNS trigger AS $$
BEGIN
  INSERT INTO activity_log(user_id, entity_type, entity_id, action)
  VALUES (
    COALESCE(NEW.student_id, NEW.tutor_id, NEW.rater_id, NEW.author_id, NEW.user_id),
    TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservations_log ON reservations;
CREATE TRIGGER trg_reservations_log AFTER INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS trg_ratings_log ON ratings;
CREATE TRIGGER trg_ratings_log AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION log_activity();

DROP TRIGGER IF EXISTS trg_posts_log ON posts;
CREATE TRIGGER trg_posts_log AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION log_activity();

COMMIT;
