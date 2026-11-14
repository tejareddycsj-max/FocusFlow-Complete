
const prisma = require('../config/db');
const { z } = require('zod');

const createTaskSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  priority: z.enum(['High', 'Medium', 'Low']).default('Medium'),
  deadline: z.string().default(''),
  day: z.string().optional().nullable(),
  plannedHours: z.number().positive().optional().default(2.0),
});

const getTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch tasks',
      error: error.message,
    });
  }
};

const createTask = async (req, res) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        ...data,
        userId: req.user.id,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({
      message: 'Invalid task input',
      error: error.errors || error.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rating, title, priority, deadline, day } = req.body;

    const existingTask = await prisma.task.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(rating !== undefined && { rating: Number(rating) }),
        ...(title !== undefined && { title }),
        ...(priority !== undefined && { priority }),
        ...(deadline !== undefined && { deadline }),
        ...(day !== undefined && { day }),
      },
    });

    // Award XP only when a task changes from pending to completed.
    if (status === 'completed' && existingTask.status !== 'completed') {
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { xp: { increment: 25 } },
      });

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          level: Math.floor(updatedUser.xp / 250) + 1,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({
      message: 'Failed to update task',
      error: error.message,
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.task.deleteMany({
      where: { id, userId: req.user.id },
    });

    if (!result.count) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(400).json({
      message: 'Failed to delete task',
      error: error.message,
    });
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
