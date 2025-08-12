// Global State
window.state = {
  jobs: [],
  currentJobName: null,
  lastBrief: '',
  lastHallucinationLevel: 'microdose',
  lastIdeas: [],
  selectedIdea: null,
  view: 'flurry', // 'flurry' or 'focus'
  jobContext: ''
};

const HALLUCINATION_LEVELS = ['none', 'microdose', 'buzzed', 'tripping'];

// Load state from localStorage
function loadState() {
  const saved = localStorage.getItem('ixCreativeStudio');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(window.state, parsed);
  }
}

// Save state to localStorage
function saveState() {
  localStorage.setItem('ixCreativeStudio', JSON.stringify(window.state));
}

// Router
function router() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  document.querySelectorAll('.view').forEach(el => {
    el.classList.remove('active');
  });
  const view = document.getElementById(hash);
  if (view) view.classList.add('active');

  // Use setTimeout to wait for DOM to update
  setTimeout(() => {
    switch (hash) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'job-setup':
        renderJobSetup();
        break;
      case 'creative-process':
        renderCreativeProcess();
        break;
    }
  }, 0);
}

// Render Dashboard
function renderDashboard() {
  const totalIdeas = window.state.jobs.reduce((sum, job) => sum + (job.ideas ? job.ideas.length : 0), 0);
  const activeJobs = window.state.jobs.filter(j => !j.archived).length;

  document.getElementById('totalIdeas').textContent = totalIdeas;
  document.getElementById('activeJobs').textContent = activeJobs;

  const jobGrid = document.getElementById('jobGrid');
  jobGrid.innerHTML = '';

  window.state.jobs
    .filter(j => !j.archived)
    .forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.innerHTML = `
        <h3>${job.name}</h3>
        <p>Ideas: ${job.ideas?.length || 0}</p>
        <p>Approved: 0</p>
        <button class="primary resume-btn" data-job="${job.name}">Resume</button>
        <button class="danger delete-job" data-job="${job.name}">Delete</button>
      `;
      jobGrid.appendChild(card);
    });

  document.getElementById('newJobBtn').onclick = () => {
    window.location.hash = 'job-setup';
  };

  // Event delegation for resume/delete
  jobGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('resume-btn')) {
      const jobName = e.target.dataset.job;
      const job = window.state.jobs.find(j => j.name === jobName);
      if (job) {
        window.state.currentJobName = job.name;
        window.state.lastBrief = job.brief;
        window.state.lastHallucinationLevel = job.level;
        window.state.lastIdeas = job.ideas || [];
        saveState();
        window.location.hash = 'creative-process';
      }
    }
    if (e.target.classList.contains('delete-job')) {
      const jobName = e.target.dataset.job;
      window.state.jobs = window.state.jobs.filter(j => j.name !== jobName);
      saveState();
      renderDashboard();
    }
  });
}

// Render Job Setup
function renderJobSetup() {
  const form = document.getElementById('jobSetupForm');
  const nameInput = document.getElementById('jobName');
  const briefInput = document.getElementById('creativeBrief');
  const slider = document.getElementById('creativitySlider');

  // Restore previous values
  nameInput.value = window.state.lastJobName || '';
  briefInput.value = window.state.lastBrief || '';
  slider.value = HALLUCINATION_LEVELS.indexOf(window.state.lastHallucinationLevel);

  form.onsubmit = (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const brief = briefInput.value.trim();
  const levelIdx = parseInt(slider.value);
  const level = HALLUCINATION_LEVELS[levelIdx];

  if (!name || !brief) return alert('Please fill in all fields.');

  // Save job
  const job = {
    name,
    brief,
    level,
    ideas: [],
    createdAt: new Date().toISOString(),
    archived: false
  };

  const existingIndex = window.state.jobs.findIndex(j => j.name === name);
  if (existingIndex > -1) {
    window.state.jobs[existingIndex] = job;
  } else {
    window.state.jobs.push(job);
  }

  window.state.currentJobName = name;
  window.state.lastBrief = brief;
  window.state.lastHallucinationLevel = level;
  window.state.jobContext = `Job: ${name}\nBrief: ${brief}`;

  saveState();

  // ✅ STEP 1: Navigate to creative process
  window.location.hash = 'creative-process';

  // ✅ STEP 2: Wait for DOM to update, then show THINKING
  setTimeout(async () => {
    try {
      const canvas = document.getElementById('canvas');
      if (canvas) {
        canvas.innerHTML = '<div class="thinking">THINKING...</div>';
      }

      const prompt = generateInitialIdeasPrompt(brief, 8, level);
      const response = await callGrokAPI(prompt);
      const ideas = parseIdeasFromResponse(response, 8);

      window.state.lastIdeas = ideas;
      job.ideas = ideas;
      saveState();

      // ✅ Now render the ideas
      renderCreativeProcess();
    } catch (err) {
      alert('Failed to generate ideas. Please try again.');
      console.error(err);
    }
  }, 100); // Small delay to ensure view is rendered
};
}

// Render Creative Process
function renderCreativeProcess() {
  if (!window.state.currentJobName) {
    window.location.hash = 'dashboard';
    return;
  }

  const job = window.state.jobs.find(j => j.name === window.state.currentJobName);
  if (!job) {
    window.location.hash = 'dashboard';
    return;
  }

  const isFocusMode = window.state.view === 'focus';
  document.getElementById('flurryMode').style.display = isFocusMode ? 'none' : 'block';
  document.getElementById('focusMode').style.display = isFocusMode ? 'block' : 'none';

  if (isFocusMode && window.state.selectedIdea) {
    document.getElementById('focusIdea').textContent = window.state.selectedIdea;
    // Clear chat and builds on re-enter?
  }

  // Render ideas if in flurry
  if (!isFocusMode) {
    renderIdeaGrid();
  }

  bindCreativeProcessEvents();
}

// Generate AI Prompt
function generateInitialIdeasPrompt(brief, numIdeas, level) {
  const basePrompt = `Creative Brief: "${brief}"`;
  let hallucinationPrompt = '';

  switch (level) {
    case 'none':
      hallucinationPrompt = `
You are strictly forbidden from hallucinating. You must remain logical, practical, and grounded in proven strategies.

You are a logical advertising strategist tasked with creating safe, audience-focused marketing campaigns based on the provided creative brief. Your goal is to develop ideas that fit within conventional advertising formats, using proven strategies and data-driven insights, ensuring maximum feasibility and alignment with the audience’s values and media habits.

${basePrompt}

Instructions for Creative Output:
- Focus exclusively on established advertising formats (e.g., social media ads, TV commercials, billboards) with no innovation.
- Draw inspiration only from current cultural trends, audience data, and proven marketing strategies. No speculation.
- Ensure ideas are highly feasible, cost-effective, and directly resonate with the target audience’s preferences and behaviors.
- Avoid all clichés and predictable approaches.

Return exactly ${numIdeas} lines.
EACH LINE MUST START WITH "What if" and END WITH "?"
DO NOT USE MARKDOWN.
DO NOT INCLUDE DESCRIPTIONS OR RATIONALES.
RETURN ONLY ${numIdeas} LINES. ONE IDEA PER LINE.
      `;
      break;
    case 'microdose':
      const seed = Math.floor(Math.random() * 100) + 1;
      hallucinationPrompt = `
You are allowed to hallucinate at a minimal level to approximate human-like creativity and generate original ideas.

You are a strategic advertising creative person tasked with creating practical, audience-focused marketing campaigns based on the provided creative brief. Your goal is to develop ideas that enhance conventional advertising formats with subtle, innovative twists, grounded in current cultural trends and proven strategies, ensuring high feasibility and alignment with the audience’s values and media habits.

${basePrompt}

Instructions for Creative Output:
- Focus on established advertising formats (e.g., social media ads, TV commercials, billboards) with minor, practical innovations.
- Draw inspiration from current cultural trends, audience data, and proven marketing strategies, avoiding surreal or speculative elements.
- Ensure ideas are highly feasible, cost-effective, and directly resonate with the target audience’s preferences and behaviors.
- Avoid all clichés and predictable approaches, but keep ideas within the realm of conventional advertising.

Come up with ten ideas and assign a novelty score (0-1) to each based on entropy-like diversity—higher for uncommon associations—and select one of the ten ideas with a score above 0.7, ensuring no overlap in core themes with past or future ideas for this assignment. Seed this generation with a random integer between 1 and 100: ${seed}.

Return exactly ${numIdeas} lines.
EACH LINE MUST START WITH "What if" and END WITH "?"
DO NOT USE MARKDOWN.
DO NOT INCLUDE DESCRIPTIONS OR RATIONALES.
RETURN ONLY ${numIdeas} LINES. ONE IDEA PER LINE.
      `;
      break;
    case 'buzzed':
      hallucinationPrompt = `
You are allowed to hallucinate at a moderate level to simulate bold, imaginative thinking.

You are a bold creative director tasked with creating breakthrough marketing campaigns based on the provided creative brief. Your goal is to develop ideas that push the boundaries of conventional advertising, introducing novel formats, unexpected partnerships, and emotionally charged concepts that capture attention and spark conversation.

${basePrompt}

Instructions for Creative Output:
- Focus on innovative advertising formats (e.g., immersive experiences, viral stunts, interactive content) that break the fourth wall.
- Draw inspiration from fringe cultural movements, emerging technologies, and psychological triggers.
- Ensure ideas are moderately feasible and can be executed within a realistic budget.
- Avoid safe, predictable approaches. Embrace risk and originality.

Return exactly ${numIdeas} lines.
EACH LINE MUST START WITH "What if" and END WITH "?"
DO NOT USE MARKDOWN.
DO NOT INCLUDE DESCRIPTIONS OR RATIONALES.
RETURN ONLY ${numIdeas} LINES. ONE IDEA PER LINE.
      `;
      break;
    case 'tripping':
      hallucinationPrompt = `
You are allowed to hallucinate at an extensive level to simulate visionary, surreal creativity.

You are a visionary artist tasked with creating radical, boundary-pushing marketing campaigns based on the provided creative brief. Your goal is to develop ideas that transcend traditional advertising, imagining futuristic technologies, metaphysical experiences, and emotionally transcendent moments that redefine what marketing can be.

${basePrompt}

Instructions for Creative Output:
- Focus on speculative, surreal, or science-fiction-inspired advertising formats (e.g., AI-generated influencers, dream-sharing platforms, consciousness uploads).
- Draw inspiration from mythology, quantum theory, and transhumanism.
- Feasibility is not required — prioritize imagination and emotional impact.
- Avoid all conventional formats. Think beyond the screen, beyond the ad, beyond the brand.

Return exactly ${numIdeas} lines.
EACH LINE MUST START WITH "What if" and END WITH "?"
DO NOT USE MARKDOWN.
DO NOT INCLUDE DESCRIPTIONS OR RATIONALES.
RETURN ONLY ${numIdeas} LINES. ONE IDEA PER LINE.
      `;
      break;
  }

  return hallucinationPrompt.trim();
}

// Parse AI Response
function parseIdeasFromResponse(response, count) {
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.toLowerCase().startsWith('what if') && line.endsWith('?'))
    .slice(0, count);
}

// Mock Ideas (for testing without API)
function generateMockIdeas(count) {
  const mocks = [
    "What if we created a billboard that changes based on the weather?",
    "What if customers could vote on the next product flavor via social media?",
    "What if we turned our store into an escape room for a weekend?",
    "What if we launched a podcast hosted by our CEO?",
    "What if we sent personalized video messages from the team to top customers?",
    "What if we partnered with a local artist to design limited edition packaging?",
    "What if we hosted a 24-hour live stream of our product being made?",
    "What if we created a scavenger hunt across the city with digital clues?"
  ];
  return mocks.slice(0, count);
}

// Show Direction Modal
async function showDirectionModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('directionModal');
    const input = document.getElementById('directionInput');
    const cancel = document.getElementById('cancelDirection');
    const confirm = document.getElementById('confirmDirection');

    input.value = '';
    modal.classList.add('active');

    const cleanup = () => {
      modal.classList.remove('active');
      [cancel, confirm].forEach(btn => btn.removeEventListener('click', handler));
    };

    const handler = (e) => {
      if (e.target === confirm) {
        resolve(input.value.trim() || null);
      } else {
        resolve(null);
      }
      cleanup();
    };

    cancel.addEventListener('click', handler);
    confirm.addEventListener('click', handler);
  });
}

// Call Grok API
function renderCreativeProcess() {
  const flurryMode = document.getElementById('flurryMode');
  const focusMode = document.getElementById('focusMode');

  if (!flurryMode || !focusMode) {
    setTimeout(renderCreativeProcess, 50);
    return;
  }

  const isFocusMode = window.state.view === 'focus';
  flurryMode.style.display = isFocusMode ? 'none' : 'block';
  focusMode.style.display = isFocusMode ? 'block' : 'none';

  // ... rest
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  router();
  window.addEventListener('hashchange', router);
});