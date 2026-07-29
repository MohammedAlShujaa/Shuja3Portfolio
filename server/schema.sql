-- Schema for the portfolio site. Postgres only, used for local development
-- and for production on Vercel. Run through: npm run seed

DROP TABLE IF EXISTS gallery;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS updates;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS socials;
DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS admin_user;

-- Single row table holding everything the hero and footer need.
CREATE TABLE profile (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  headline            TEXT NOT NULL,
  subheading          TEXT NOT NULL,
  intro               TEXT NOT NULL,
  photo_url           TEXT,
  cta_primary_label   TEXT,
  cta_primary_href    TEXT,
  cta_secondary_label TEXT,
  cta_secondary_href  TEXT,
  location            TEXT,
  availability        TEXT,
  resume_url          TEXT
);

CREATE TABLE socials (
  id       SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  url      TEXT NOT NULL,
  icon     TEXT
);

-- group_name is one of the four skill clusters shown on the About page.
CREATE TABLE skills (
  id         SERIAL PRIMARY KEY,
  group_name TEXT NOT NULL,
  name       TEXT NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- category is one of: Machine Learning, NLP & Data, Web Development
CREATE TABLE projects (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  tech_tags     TEXT,
  thumbnail_url TEXT,
  github_url    TEXT,
  live_url      TEXT,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE updates (
  id    SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body  TEXT NOT NULL,
  date  DATE NOT NULL DEFAULT CURRENT_DATE,
  tag   TEXT
);

CREATE TABLE messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE
);

-- Modeling gallery. A standalone photo page, separate from the ML portfolio.
-- category is one of: Studio, Brand & Product, Casting, Editorial
CREATE TABLE gallery (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  category    TEXT NOT NULL DEFAULT 'Editorial',
  image_url   TEXT NOT NULL,
  thumb_url   TEXT,
  credit      TEXT,
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Single admin account for this student project. Only the bcrypt hash is stored.
CREATE TABLE admin_user (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE INDEX idx_projects_category ON projects (category);
CREATE INDEX idx_skills_group ON skills (group_name, sort_order);
CREATE INDEX idx_messages_created ON messages (created_at DESC);
CREATE INDEX idx_gallery_sort ON gallery (sort_order, id);
