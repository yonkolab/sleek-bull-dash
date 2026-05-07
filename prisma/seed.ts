import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')
  console.log('ℹ️  No seed data needed — BullMQ data lives in Redis, not SQLite.')
  console.log('   Auth tables (user, session, account) are managed by Better Auth.')
  console.log('   Public sign-up is disabled.')
  console.log('   Create users in Prisma Studio and store a Better Auth password hash in Account.password.')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
