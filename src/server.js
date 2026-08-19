const app = require('./app');
const env = require('./config/env');
const sequelize = require('./config/database');
require('./models'); // 모델 로드 및 연관관계 설정

async function start() {
  try {
    await sequelize.authenticate();
    console.log('[DB] MySQL 연결 성공');

    await sequelize.sync();
    console.log('[DB] 스키마 동기화 완료');

    // 신규 컬럼 자동 마이그레이션
    const migrations = [
      "ALTER TABLE users ADD COLUMN country VARCHAR(255) DEFAULT 'South Korea';",
      "ALTER TABLE users ADD COLUMN lunch_hours VARCHAR(255) DEFAULT '12:00 - 13:00';",
      "ALTER TABLE recipients ADD COLUMN custom_style TEXT;",
      "ALTER TABLE recipients ADD COLUMN preferred_style VARCHAR(255);",
      "ALTER TABLE team_memories ADD COLUMN user_id INT NULL;",
      // Existing accounts keep their current behavior. New accounts are explicitly created with false.
      "ALTER TABLE users ADD COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 1;",
      "ALTER TABLE users MODIFY COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;",
      "ALTER TABLE message_results ADD COLUMN gmail_message_id VARCHAR(100) NULL;",
      "ALTER TABLE message_results ADD COLUMN gmail_thread_id VARCHAR(100) NULL;",
      "ALTER TABLE recipients MODIFY COLUMN response_speed VARCHAR(255) NULL DEFAULT NULL;",
      "ALTER TABLE recipients MODIFY COLUMN average_response_minutes INT NULL DEFAULT NULL;",
      "ALTER TABLE recipients MODIFY COLUMN collaboration_activity VARCHAR(255) NULL DEFAULT NULL;",
    ];
    for (const sql of migrations) {
      try {
        await sequelize.query(sql);
      } catch {
        // 이미 존재하는 컬럼은 무시
      }
    }
    console.log('[DB] 신규 컬럼 안전 마이그레이션 완료');

    app.listen(env.port, () => {
      console.log(`[Server] http://localhost:${env.port} 에서 실행 중`);
    });
  } catch (err) {
    console.error('[Server] 시작 실패:', err);
    process.exit(1);
  }
}

start();
