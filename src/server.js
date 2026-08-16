const app = require('./app');
const env = require('./config/env');
const sequelize = require('./config/database');
require('./models'); // 모델 로드 및 연관관계 설정

async function start() {
  try {
    await sequelize.authenticate();
    console.log('[DB] MySQL 연결 성공');

    // 개발 초기 단계 편의용. 운영에서는 마이그레이션으로 대체 예정.
    await sequelize.sync({ alter: true });
    console.log('[DB] 스키마 동기화 완료');

    app.listen(env.port, () => {
      console.log(`[Server] http://localhost:${env.port} 에서 실행 중`);
    });
  } catch (err) {
    console.error('[Server] 시작 실패:', err);
    process.exit(1);
  }
}

start();
