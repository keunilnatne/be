const { User, GmailIntegration } = require('./src/models');

async function main() {
  const users = await User.findAll();
  console.log('=== USERS & GMAIL STATUS ===');
  for (const u of users) {
    const integration = await GmailIntegration.findOne({ where: { userId: u.id } });
    console.log(`[User ${u.id}] ${u.name} (${u.email}) - googleConnected: ${u.googleConnected}, googleEmail: ${u.googleEmail}, hasGmailIntegration: ${!!integration}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
