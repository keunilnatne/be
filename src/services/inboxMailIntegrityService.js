const sequelize = require('../config/database');

const UNIQUE_INDEX_NAME = 'inbox_mails_user_gmail_message_unique';

function mysqlErrorCode(error) {
  return error?.original?.code || error?.parent?.code || error?.code;
}

async function ensureInboxMailUniqueness(database = sequelize) {
  try {
    // Keep the most recently stored copy of each Gmail message.
    await database.query(`
      DELETE older
      FROM inbox_mails AS older
      INNER JOIN inbox_mails AS newer
        ON older.user_id = newer.user_id
       AND older.gmail_message_id = newer.gmail_message_id
       AND older.id < newer.id
    `);
  } catch (error) {
    if (mysqlErrorCode(error) === 'ER_NO_SUCH_TABLE') return { tableMissing: true };
    throw error;
  }

  try {
    await database.query(`
      ALTER TABLE inbox_mails
      ADD UNIQUE INDEX ${UNIQUE_INDEX_NAME} (user_id, gmail_message_id)
    `);
  } catch (error) {
    if (mysqlErrorCode(error) !== 'ER_DUP_KEYNAME') throw error;
  }

  return { tableMissing: false };
}

module.exports = {
  UNIQUE_INDEX_NAME,
  ensureInboxMailUniqueness,
};
