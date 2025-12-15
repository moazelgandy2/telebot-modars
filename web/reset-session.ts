
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Resetting session string...")
  try {
      const result = await prisma.botSetting.updateMany({
        where: { key: 'stringSession' },
        data: { value: '' }
      })
      console.log(`Session cleared. Updated ${result.count} records.`)
  } catch (err) {
      console.error("Error clearing session:", err)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
