import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { AzureOpenAI } from 'openai';
import { buildAIPrompt } from './src/aiPromptBuilder.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Debug Azure OpenAI environment variables
console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? 'Loaded' : 'Missing');
console.log('OPENAI_API_BASE:', process.env.OPENAI_API_BASE);
console.log('OPENAI_API_VERSION:', process.env.OPENAI_API_VERSION);
console.log('OPENAI_API_DEPLOYMENT:', process.env.OPENAI_API_DEPLOYMENT);

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000', // adjust if your frontend is elsewhere
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.OPENAI_API_BASE,
  apiVersion: process.env.OPENAI_API_VERSION,
});

app.post('/api/generate-schedule', async (req, res) => {
  try {
    const { userId, ...userData } = req.body;

    // Fetch recent manual tasks for the user from Supabase
    const { data: manualTasks, error } = await supabase
      .from('manual_tasks')
      .select('name, time')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Build the AI prompt including recent manual tasks
    const prompt = buildAIPrompt({ ...userData, recentManualTasks: manualTasks });
    console.log('AI Prompt:', prompt);

    // Call Azure OpenAI with deployment name
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_API_DEPLOYMENT, // e.g. 'o4-mini'
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });

    res.json({ schedule: response.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

// Endpoint to save manual tasks
app.post('/api/manual-tasks', async (req, res) => {
  try {
    const { userId, name, time } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'Missing userId or task name' });
    }

    const { data, error } = await supabase
      .from('manual_tasks')
      .insert([{ user_id: userId, name, time }]);

    if (error) throw error;

    res.status(201).json({ message: 'Manual task saved', task: data[0] });
  } catch (error) {
    console.error('Error saving manual task:', error);
    res.status(500).json({ error: 'Failed to save manual task' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));