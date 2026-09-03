ALTER TABLE users ADD COLUMN IF NOT EXISTS show_badge boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_status_bio boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_vip_label boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follow_visibility varchar(20) DEFAULT 'everyone';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS title_color varchar(30);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS title_style varchar(20);
