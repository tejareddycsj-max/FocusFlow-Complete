
const prisma = require('../config/db');

const logSession = async (req, res) => {
  try {
    const { subject, mode, durationSeconds } = req.body;

    const sessionMode = mode || 'pomodoro';
    const duration = Number(durationSeconds);

    if (!Number.isInteger(duration) || duration <= 0) {
      return res.status(400).json({
        message: 'Duration must be a positive whole number',
      });
    }

    if (!['pomodoro', 'shortBreak', 'longBreak'].includes(sessionMode)) {
      return res.status(400).json({
        message: 'Invalid session mode',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.studySession.create({
        data: {
          userId: req.user.id,
          subject: subject || 'General Study',
          mode: sessionMode,
          durationSeconds: duration,
        },
      });

      let user = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { xp: true, level: true },
      });

      if (sessionMode === 'pomodoro') {
        user = await tx.user.update({
          where: { id: req.user.id },
          data: {
            xp: { increment: 25 },
          },
          select: { xp: true, level: true },
        });

        const newLevel = Math.floor(user.xp / 250) + 1;

        user = await tx.user.update({
          where: { id: req.user.id },
          data: { level: newLevel },
          select: { xp: true, level: true },
        });
      }

      return {
        session,
        xp: user.xp,
        level: user.level,
      };
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      message: 'Failed to log focus session',
      error: error.message,
    });
  }
};

const getSessionStats = async (req, res) => {
  try {
    console.log("Backend user ID:", req.user.id);
    const sessions = await prisma.studySession.findMany({
      where: {
        userId: req.user.id,
        mode: 'pomodoro',
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log("Sessions found:", sessions.length);
console.log("Sessions:", sessions);

    const totalSeconds = sessions.reduce(
      (sum, session) => sum + session.durationSeconds,
      0
    );

    res.json({
  completedSessions: sessions.length,
  totalFocusedHours: Number((totalSeconds / 3600).toFixed(1)),
  recentSessions: sessions.slice(0, 10),
  sessions
});
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch session stats',
      error: error.message,
    });
  }
};

module.exports = { logSession, getSessionStats };
