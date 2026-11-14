
const prisma = require('../config/db');

const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [tasks, sessions] = await Promise.all([
      prisma.task.findMany({ where: { userId } }),
      prisma.studySession.findMany({
        where: { userId, mode: 'pomodoro' },
      }),
    ]);

    const completedTasks = tasks.filter(
      (task) => task.status === 'completed'
    ).length;

    const totalTasks = tasks.length;

    const completionRate =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const totalFocusedSeconds = sessions.reduce(
      (sum, session) => sum + session.durationSeconds,
      0
    );

    const totalStudyHours = Number(
      (totalFocusedSeconds / 3600).toFixed(1)
    );

    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const dailyFocusedSeconds = sessions
      .filter(
        (session) =>
          new Date(session.createdAt).getTime() >= last24Hours
      )
      .reduce((sum, session) => sum + session.durationSeconds, 0);

    const weeklyFocusedSeconds = sessions
      .filter(
        (session) =>
          new Date(session.createdAt).getTime() >= last7Days
      )
      .reduce((sum, session) => sum + session.durationSeconds, 0);

    const dailyGoal = req.user.studyGoal || 4;

    const dailyScore = Math.min(
      100,
      Math.round((dailyFocusedSeconds / (dailyGoal * 3600)) * 100)
    );

    const weeklyScore = Math.min(
      100,
      Math.round(
        (weeklyFocusedSeconds / (dailyGoal * 7 * 3600)) * 100
      )
    );

    const subjectMap = {};

    tasks.forEach((task) => {
      if (!subjectMap[task.subject]) {
        subjectMap[task.subject] = {
          planned: 0,
          actual: 0,
        };
      }

      subjectMap[task.subject].planned += task.plannedHours;
      subjectMap[task.subject].actual += task.actualHours;
    });

    const strongTopics = tasks.filter((task) => task.rating >= 4);
    const weakTopics = tasks.filter((task) => task.rating <= 2);

    res.json({
      metrics: {
        dailyScore,
        weeklyScore,
        totalHours: totalStudyHours,
        targetHours: dailyGoal * 7,
        completedTasks,
        totalTasks,
        completionRate,
      },
      analytics: {
        subjects: subjectMap,
        strongTopics,
        weakTopics,
      },
      gamification: {
        streak: req.user.streak,
        xp: req.user.xp,
        level: req.user.level,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error loading dashboard',
      error: error.message,
    });
  }
};

module.exports = { getDashboardData };
