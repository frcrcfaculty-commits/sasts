/**
 * AI Service for SASTS
 * Uses Ollama with local LLM for quiz generation, marks analysis, etc.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.AI_MODEL || 'llama3.1';

// Check if Ollama is available
async function isOllamaAvailable() {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        return response.ok;
    } catch {
        return false;
    }
}

// Generate content using Ollama
async function generateWithOllama(prompt, model = DEFAULT_MODEL) {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: 2000
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Ollama generation error:', error);
        throw error;
    }
}

// Generate MCQ quiz from module content
async function generateMCQQuiz(moduleContent, moduleName, questionCount = 10, difficulty = 'medium') {
    const difficultyGuide = {
        easy: 'basic recall and understanding questions',
        medium: 'application and analysis questions',
        hard: 'synthesis and evaluation questions with tricky options'
    };

    const prompt = `You are an expert educational content creator. Generate exactly ${questionCount} multiple choice questions based on the following module content.

Module: ${moduleName}
Difficulty: ${difficulty} (${difficultyGuide[difficulty]})

Content:
${moduleContent}

Generate questions in this exact JSON format (no markdown, just pure JSON):
{
  "questions": [
    {
      "id": 1,
      "question": "What is...",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_answer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Important rules:
1. Each question must have exactly 4 options
2. correct_answer is the index (0-3) of the correct option
3. Questions should test understanding, not just memorization
4. Make wrong options plausible but clearly incorrect
5. Return ONLY valid JSON, no other text`;

    try {
        const response = await generateWithOllama(prompt);
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from AI');
    } catch (error) {
        console.error('MCQ generation error:', error);
        // Return fallback
        return generateFallbackMCQ(moduleName, questionCount);
    }
}

// Generate crossword puzzle from module content
async function generateCrossword(moduleContent, moduleName, wordCount = 10) {
    const prompt = `You are an expert educational content creator. Generate a crossword puzzle based on the following module content.

Module: ${moduleName}

Content:
${moduleContent}

Generate ${wordCount} words with clues in this exact JSON format (no markdown, just pure JSON):
{
  "title": "Crossword: ${moduleName}",
  "words": [
    {
      "word": "ALGORITHM",
      "clue": "A step-by-step procedure for solving a problem"
    }
  ]
}

Important rules:
1. Words should be key terms from the content
2. Words should be 4-12 characters, uppercase, no spaces
3. Clues should be clear and educational
4. Return ONLY valid JSON, no other text`;

    try {
        const response = await generateWithOllama(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Generate crossword grid from words
            return generateCrosswordGrid(parsed);
        }
        throw new Error('Invalid JSON response from AI');
    } catch (error) {
        console.error('Crossword generation error:', error);
        return generateFallbackCrossword(moduleName);
    }
}

// Generate fill-in-the-blanks questions
async function generateFillBlanks(moduleContent, moduleName, questionCount = 10) {
    const prompt = `You are an expert educational content creator. Generate ${questionCount} fill-in-the-blank questions from the following module content.

Module: ${moduleName}

Content:
${moduleContent}

Generate in this exact JSON format (no markdown, just pure JSON):
{
  "questions": [
    {
      "id": 1,
      "sentence": "A _____ is a data structure that follows LIFO principle.",
      "answer": "stack",
      "hint": "Think about plates piled on top of each other"
    }
  ]
}

Important rules:
1. Replace ONE key term with _____
2. The answer should be a single word or short phrase
3. Provide helpful hints
4. Return ONLY valid JSON, no other text`;

    try {
        const response = await generateWithOllama(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from AI');
    } catch (error) {
        console.error('Fill blanks generation error:', error);
        return { questions: [] };
    }
}

// Generate flashcards from module content
async function generateFlashcards(moduleContent, moduleName, cardCount = 15) {
    const prompt = `You are an expert educational content creator. Generate ${cardCount} flashcards for studying the following module content.

Module: ${moduleName}

Content:
${moduleContent}

Generate in this exact JSON format (no markdown, just pure JSON):
{
  "cards": [
    {
      "id": 1,
      "front": "What is a binary tree?",
      "back": "A tree data structure where each node has at most two children, referred to as left and right child."
    }
  ]
}

Important rules:
1. Front should be a question or term
2. Back should be a clear, concise explanation
3. Cover key concepts from the module
4. Return ONLY valid JSON, no other text`;

    try {
        const response = await generateWithOllama(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from AI');
    } catch (error) {
        console.error('Flashcards generation error:', error);
        return { cards: [] };
    }
}

// Analyze marks and suggest strong/weak students
async function analyzeMarksForSuggestions(marksData, topN = 10) {
    // Sort by percentage
    const sorted = [...marksData].sort((a, b) => b.percentage - a.percentage);

    const suggestions = [];

    // Top performers (strong)
    const topStudents = sorted.slice(0, topN);
    for (const student of topStudents) {
        suggestions.push({
            studentId: student.student_id,
            suggestedCategory: 'strong',
            confidenceScore: Math.min(95, 50 + student.percentage / 2),
            reason: `Scored ${student.percentage.toFixed(1)}% - among top ${topN} performers. High academic achievement indicates potential for advanced activities.`
        });
    }

    // Bottom performers (weak)
    const bottomStudents = sorted.slice(-topN).reverse();
    for (const student of bottomStudents) {
        suggestions.push({
            studentId: student.student_id,
            suggestedCategory: 'weak',
            confidenceScore: Math.min(95, 100 - student.percentage / 2),
            reason: `Scored ${student.percentage.toFixed(1)}% - among bottom ${topN} performers. May benefit from additional support and remedial activities.`
        });
    }

    return suggestions;
}

// Parse syllabus content to extract modules
async function parseSyllabusContent(syllabusText, courseName) {
    const prompt = `You are an expert at parsing academic syllabi. Extract the module/unit structure from the following syllabus.

Course: ${courseName}

Syllabus Content:
${syllabusText.substring(0, 4000)}

Extract modules in this exact JSON format (no markdown, just pure JSON):
{
  "course_name": "${courseName}",
  "modules": [
    {
      "number": 1,
      "name": "Introduction to ...",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "hours": 8
    }
  ]
}

Important rules:
1. Identify all distinct modules/units
2. List specific topics covered in each module
3. Estimate hours if not specified
4. Return ONLY valid JSON, no other text`;

    try {
        const response = await generateWithOllama(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from AI');
    } catch (error) {
        console.error('Syllabus parsing error:', error);
        return { course_name: courseName, modules: [] };
    }
}

// Fallback generators (when AI is not available)
function generateFallbackMCQ(moduleName, count) {
    return {
        questions: Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            question: `Sample question ${i + 1} about ${moduleName}`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_answer: 0,
            explanation: 'This is a sample question. AI generation was not available.'
        }))
    };
}

function generateFallbackCrossword(moduleName) {
    return {
        title: `Crossword: ${moduleName}`,
        words: [],
        grid: [],
        message: 'AI generation was not available. Please add words manually.'
    };
}

// Simple crossword grid generator
function generateCrosswordGrid(crosswordData) {
    // For now, return the words without grid (grid generation is complex)
    // In production, you'd use a proper crossword algorithm
    return {
        ...crosswordData,
        grid: null,
        note: 'Use a crossword generator library for the grid'
    };
}

module.exports = {
    isOllamaAvailable,
    generateWithOllama,
    generateMCQQuiz,
    generateCrossword,
    generateFillBlanks,
    generateFlashcards,
    analyzeMarksForSuggestions,
    parseSyllabusContent
};
