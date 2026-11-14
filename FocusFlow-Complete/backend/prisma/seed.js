const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'vardhan@university.edu' },
    update: {},
    create: {
      name: 'Vardhan Kamma',
      email: 'vardhan@university.edu',
      studentId: 'DSU2026CS101',
      department: 'Computer Science',
      academicYear: '3rd Year',
      studyGoal: 4.0,
      streak: 7,
      xp: 650,
      level: 4,
      tasks: {
        create: [
          {
            title: 'Relational Schema & Drizzle ORM setup',
            subject: 'Database Systems',
            priority: 'High',
            deadline: '2026-11-20',
            status: 'completed',
            rating: 5,
            plannedHours: 4.0,
            actualHours: 4.5,
          },
          {
            title: 'Graph Traversal Algorithms (BFS/DFS)',
            subject: 'Algorithms & Data Structures',
            priority: 'High',
            deadline: '2026-11-22',
            status: 'pending',
            rating: 2,
            plannedHours: 5.0,
            actualHours: 2.0,
          },
          {
            title: 'React Canvas State Sync Module',
            subject: 'Web Development',
            priority: 'Medium',
            deadline: '2026-11-25',
            status: 'pending',
            rating: 4,
            plannedHours: 3.0,
            actualHours: 2.5,
          },
        ],
      },
    },
  });

  console.log('Seeded default user:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
