const sequelize = require('./config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Authenticated');

    // 1. users 테이블 컬럼 추가
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN country VARCHAR(255) DEFAULT 'South Korea';");
      console.log('✓ Added country to users');
    } catch (e) {
      console.log('users.country note:', e.message);
    }

    // 2. recipients 테이블 컬럼 추가
    try {
      await sequelize.query("ALTER TABLE recipients ADD COLUMN custom_style TEXT;");
      console.log('✓ Added custom_style to recipients');
    } catch (e) {
      console.log('recipients.custom_style note:', e.message);
    }

    try {
      await sequelize.query("ALTER TABLE recipients ADD COLUMN preferred_style VARCHAR(255);");
      console.log('✓ Added preferred_style to recipients');
    } catch (e) {
      console.log('recipients.preferred_style note:', e.message);
    }

    // 3. team_memories 테이블 컬럼 추가
    try {
      await sequelize.query("ALTER TABLE team_memories ADD COLUMN user_id INT NULL;");
      console.log('✓ Added user_id to team_memories');
    } catch (e) {
      console.log('team_memories.user_id note:', e.message);
    }

    console.log('[DB] Migration finished successfully');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
  } finally {
    await sequelize.close();
  }
}

migrate();
