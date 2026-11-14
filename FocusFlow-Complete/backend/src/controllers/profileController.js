
const prisma = require('../config/db');

const getProfileAndSettings = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    res.json({
      profile: {
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        department: user.department,
        academicYear: user.academicYear,
        studyGoal: user.studyGoal,
      },
      settings: {
        pomodoro: user.pomoMinutes,
        shortBreak: user.shortBreakMinutes,
        longBreak: user.longBreakMinutes,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch profile',
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      studentId,
      department,
      academicYear,
      studyGoal,
    } = req.body;

    if (
      studyGoal !== undefined &&
      (!Number.isFinite(Number(studyGoal)) || Number(studyGoal) <= 0)
    ) {
      return res.status(400).json({
        message: 'Study goal must be a positive number',
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(studentId !== undefined && { studentId }),
        ...(department !== undefined && { department }),
        ...(academicYear !== undefined && { academicYear }),
        ...(studyGoal !== undefined && {
          studyGoal: Number(studyGoal),
        }),
      },
    });

    res.json({
      name: updated.name,
      email: updated.email,
      studentId: updated.studentId,
      department: updated.department,
      academicYear: updated.academicYear,
      studyGoal: updated.studyGoal,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { pomodoro, shortBreak, longBreak } = req.body;

    const values = { pomodoro, shortBreak, longBreak };

    for (const [key, value] of Object.entries(values)) {
      if (
        value !== undefined &&
        (!Number.isInteger(Number(value)) || Number(value) <= 0)
      ) {
        return res.status(400).json({
          message: `${key} must be a positive whole number`,
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(pomodoro !== undefined && {
          pomoMinutes: Number(pomodoro),
        }),
        ...(shortBreak !== undefined && {
          shortBreakMinutes: Number(shortBreak),
        }),
        ...(longBreak !== undefined && {
          longBreakMinutes: Number(longBreak),
        }),
      },
    });

    res.json({
      pomodoro: updated.pomoMinutes,
      shortBreak: updated.shortBreakMinutes,
      longBreak: updated.longBreakMinutes,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Failed to update settings',
      error: error.message,
    });
  }
};

module.exports = {
  getProfileAndSettings,
  updateProfile,
  updateSettings,
};
