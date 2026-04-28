-- =====================================================================
-- Migration : Ajout des champs du profil utilisateur étendu
-- Exécuter dans : Supabase → SQL Editor
-- =====================================================================

-- Ajouter les colonnes si elles n'existent pas déjà
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_name    TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS address      TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS postal_code  TEXT;

-- Vérifier que first_name existe (normalement déjà présente)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name   TEXT;

-- =====================================================================
-- Optionnel : Politique RLS pour permettre à chaque user de lire/modifier son profil
-- =====================================================================

-- Autoriser l'utilisateur à mettre à jour son propre profil
CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Autoriser l'utilisateur à lire son propre profil
CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);
