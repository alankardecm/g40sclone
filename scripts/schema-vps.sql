-- Schema para Banco de Dados MySQL na VPS (Hostinger)
-- Substitui a estrutura PostgreSQL/Supabase pelas tabelas locais do G4OS

-- 1. Tabela de Usuários e Permissões (Substitui hub_users)
CREATE TABLE IF NOT EXISTS os_users (
  email VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  picture TEXT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user',
  first_login DATETIME NULL,
  last_login DATETIME NULL,
  pages JSON NOT NULL, -- Usando tipo JSON nativo do MySQL 8
  token_version INT NOT NULL DEFAULT 0,
  pre_registered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir Superadmin inicial por padrão para evitar bloqueio no primeiro acesso
-- Substitua pelo seu email se necessário
INSERT INTO os_users (email, name, role, pages) 
VALUES ('alan.moreira@netturbo.com.br', 'Alan Moreira', 'superadmin', '{
  "chat": true,
  "dashboards": true,
  "dashboardTables": [],
  "monitoring": true,
  "zabbix": true,
  "whatsapp": true,
  "datalake": true,
  "rag": true,
  "netmeet": true
}')
ON DUPLICATE KEY UPDATE role='superadmin';

-- 2. Tabela de Mapeamento Telefone -> Email (Substitui hub_phone_email)
CREATE TABLE IF NOT EXISTS os_phone_email (
  phone VARCHAR(32) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Áudios Pendentes (Substitui hub_pending_audios)
CREATE TABLE IF NOT EXISTS os_pending_audios (
  phone VARCHAR(32) PRIMARY KEY,
  instance VARCHAR(100) NOT NULL,
  item JSON NOT NULL,
  reply_to TEXT NOT NULL,
  push_name VARCHAR(255) NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Reuniões NetMeet (Substitui netmeet_meetings)
CREATE TABLE IF NOT EXISTS os_meetings (
  id VARCHAR(64) PRIMARY KEY, -- Armazena string numérica do Date.now()
  title VARCHAR(255) NOT NULL DEFAULT 'Reunião sem título',
  meeting_link TEXT NULL,
  classification VARCHAR(100) NOT NULL DEFAULT 'interno',
  transcript LONGTEXT NOT NULL,
  summary TEXT NOT NULL,
  decisions JSON NOT NULL,
  risks JSON NOT NULL,
  next_steps JSON NOT NULL,
  action_items JSON NOT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'pending',
  published_to_teams BOOLEAN NOT NULL DEFAULT FALSE,
  user_email VARCHAR(255) NULL,
  sender_phone VARCHAR(32) NULL,
  sender_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para buscas rápidas
CREATE INDEX idx_os_meetings_user_email ON os_meetings(user_email);
CREATE INDEX idx_os_meetings_created_at ON os_meetings(created_at DESC);

-- 5. Tabela de mapeamento LID WhatsApp → número real (Substitui hub_bot_lid_registry)
CREATE TABLE IF NOT EXISTS os_bot_lid_registry (
  lid VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
