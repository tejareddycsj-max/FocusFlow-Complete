
const prisma = require('../config/db');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateGeminiResponse = async (ai, contents) => {
  const maxAttempts = 3;
  const delays = [1000, 2000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
      });
    } catch (error) {
      const status = Number(
        error.status || error.code || error.response?.status
      );

      const retryable = [429, 500, 502, 503, 504].includes(status);

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      await wait(delays[attempt - 1]);
    }
  }
};

const chatWithAssistant = async (req, res) => {
  try {
    const { message } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        message: 'Message text is required',
      });
    }

    const userMessage = message.trim();

    if (userMessage.length > 2000) {
      return res.status(400).json({
        message: 'Message cannot exceed 2000 characters',
      });
    }

    const [tasks, history] = await Promise.all([
      prisma.task.findMany({
        where: { userId: req.user.id },
      }),
      prisma.chatMessage.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const weakTopics = tasks
      .filter((t) => t.rating <= 2)
      .map((t) => `${t.title} (${t.subject}, Rating: ${t.rating}/5)`);

    const pendingTasks = tasks
      .filter((t) => t.status === 'pending')
      .map((t) => `${t.title} [Priority: ${t.priority}, Due: ${t.deadline}]`);

    let reply = '';

    if (
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ) {
      const { GoogleGenAI } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const systemContext = `
You are FocusFlow AI, a concise and practical academic study coach.

Student: ${req.user.name}
Department: ${req.user.department}
Academic Year: ${req.user.academicYear}

Weak Topics:
${weakTopics.length ? weakTopics.join(', ') : 'None currently'}

Pending Tasks:
${pendingTasks.length ? pendingTasks.join('; ') : 'No pending tasks'}

Daily Study Goal: ${req.user.studyGoal} hours.

Give clear, structured and actionable responses.
Keep answers concise, usually 3-5 sentences.
      `.trim();

      const conversation = history
        .reverse()
        .map((item) => ({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.message }],
        }));

      const contents = [
        ...conversation,
        {
          role: 'user',
          parts: [{
            text: `${systemContext}\n\nStudent Question: ${userMessage}`,
          }],
        },
      ];

      const response = await generateGeminiResponse(ai, contents);

      reply = response.text ||
        'I could not generate a response. Please try again.';
    } else {
      if (weakTopics.length > 0) {
        reply = `Based on your study records, your weakest topic is ${weakTopics[0]}. Start a ${req.user.pomoMinutes}-minute focus session on it before moving to other tasks.`;
      } else if (pendingTasks.length > 0) {
        reply = `You have ${pendingTasks.length} pending tasks. Focus first on ${pendingTasks[0]} using a ${req.user.pomoMinutes}-minute Pomodoro block.`;
      } else {
        reply = 'Great work! You currently have no pending tasks. You can use this time to revise previous topics or plan your next study goal.';
      }
    }

    await prisma.chatMessage.createMany({
      data: [
        {
          userId: req.user.id,
          sender: 'user',
          message: userMessage,
        },
        {
          userId: req.user.id,
          sender: 'bot',
          message: reply,
        },
      ],
    });

    return res.json({ reply });
  } catch (error) {
    console.error('AI Assistant error:', error.message);

    const status = Number(
      error.status || error.code || error.response?.status
    );

    if ([429, 500, 502, 503, 504].includes(status)) {
      return res.status(503).json({
        message: 'Gemini is temporarily unavailable. Please try again shortly.',
      });
    }

    return res.status(500).json({
      message: 'AI Assistant error. Please try again.',
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const history = await prisma.chatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return res.json(history.reverse());
  } catch (error) {
    console.error('Chat history error:', error.message);

    return res.status(500).json({
      message: 'Failed to load chat history',
    });
  }
};

module.exports = { chatWithAssistant, getChatHistory };
