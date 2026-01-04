const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log("OK");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
