// Render Idea Grid
function renderIdeaGrid() {
  const grid = document.getElementById('ideaGrid');
  grid.innerHTML = '';

  window.state.lastIdeas.forEach((idea, index) => {
    const card = document.createElement('div');
    card.className = 'idea-card';
    card.dataset.index = index;

    card.innerHTML = `
      <div class="idea-content">${idea}</div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      window.state.selectedIdea = idea;
      window.state.view = 'focus';
      saveState();
      renderCreativeProcess();
    });

    grid.appendChild(card);
  });
}

// Bind Events for Creative Process
function bindCreativeProcessEvents() {
  // Replace Selected
  document.getElementById('replaceSelectedBtn').onclick = async () => {
    const selected = Array.from(document.querySelectorAll('.idea-card.selected'));
    if (selected.length === 0) {
      alert('Please select at least one idea to replace.');
      return;
    }

    const guidance = await showDirectionModal();
    const indices = selected.map(el => parseInt(el.dataset.index));
    const count = indices.length;

    // Fade out
    selected.forEach(el => el.classList.add('fade-out'));

    setTimeout(async () => {
      try {
        const prompt = buildReplacementPrompt(guidance);
        const response = await callGrokAPI(prompt);
        const newIdeas = parseIdeasFromResponse(response, count);

        // Replace in state
        for (let i = 0; i < indices.length; i++) {
          window.state.lastIdeas[indices[i]] = newIdeas[i];
        }

        const job = window.state.jobs.find(j => j.name === window.state.currentJobName);
        if (job) job.ideas = window.state.lastIdeas;

        saveState();
        renderIdeaGrid(); // Re-render with fade-in handled by CSS
      } catch (err) {
        alert('Failed to replace ideas.');
        console.error(err);
      }
    }, 1500);
  };

  // New Flurry
  document.getElementById('newFlurryBtn').onclick = async () => {
    const guidance = await showDirectionModal();
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="thinking">THINKING...</div>';

    try {
      const prompt = buildNewFlurryPrompt(guidance);
      const response = await callGrokAPI(prompt);
      const newIdeas = parseIdeasFromResponse(response, 8);
      window.state.lastIdeas = newIdeas;

      const job = window.state.jobs.find(j => j.name === window.state.currentJobName);
      if (job) job.ideas = newIdeas;

      saveState();
      renderIdeaGrid();
    } catch (err) {
      alert('Failed to generate new flurry.');
      console.error(err);
    }
  };

  // Back to Flurry
  document.getElementById('backToFlurry').onclick = () => {
    window.state.view = 'flurry';
    saveState();
    renderCreativeProcess();
  };

  // Chat
  document.getElementById('sendChatBtn').onclick = async () => {
    const input = document.getElementById('chatInput');
    const value = input.value.trim();
    if (!value) return;

    const messages = document.getElementById('chatMessages');
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message';
    userMsg.textContent = value;
    messages.appendChild(userMsg);

    try {
      const prompt = `Context: ${window.state.jobContext}\nCurrent idea: ${window.state.selectedIdea}\nUser asks: ${value}\nRespond concisely as a creative AI.`;
      const response = await callGrokAPI(prompt);
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message ai-message';
      aiMsg.textContent = response;
      messages.appendChild(aiMsg);
    } catch (err) {
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message ai-message';
      aiMsg.textContent = "Sorry, I couldn't respond right now.";
      messages.appendChild(aiMsg);
    }

    input.value = '';
    messages.scrollTop = messages.scrollHeight;
  };

  // Develop Idea
  document.getElementById('developIdeaBtn').onclick = async () => {
    const input = document.getElementById('buildInput');
    const instruction = input.value.trim() || 'Develop this into 4 campaign elements: headlines, activations, visuals, and taglines';
    const results = document.getElementById('buildResults');
    results.innerHTML = '<div class="thinking">Generating...</div>';

    try {
      const prompt = `Based on this idea: "${window.state.selectedIdea}", ${instruction}. Return exactly 4 items. Each line: Title :: Description. No numbering, no markdown.`;
      const response = await callGrokAPI(prompt);
      const lines = response.split('\n').filter(l => l.includes('::')).slice(0, 4);

      results.innerHTML = '';
      lines.forEach(line => {
        const [title, desc] = line.split('::').map(s => s.trim());
        const card = document.createElement('div');
        card.className = 'build-card';
        card.innerHTML = `
          <div class="build-title">${title}</div>
          <div>${desc}</div>
        `;
        results.appendChild(card);
      });
    } catch (err) {
      results.innerHTML = '<div>Error generating builds.</div>';
    }
  };
}

// Build Replacement Prompt
function buildReplacementPrompt(guidance) {
  const brief = window.state.lastBrief;
  const level = window.state.lastHallucinationLevel;
  const base = generateInitialIdeasPrompt(brief, 8, level);
  const context = `Replace only the following ideas from a previous response, keeping the same tone and creativity level. ${guidance ? `User guidance: ${guidance}` : ''}`;
  return `${base}\n\n${context}`;
}

// Build New Flurry Prompt
function buildNewFlurryPrompt(guidance) {
  const brief = window.state.lastBrief;
  const level = window.state.lastHallucinationLevel;
  let prompt = generateInitialIdeasPrompt(brief, 8, level);
  if (guidance) {
    prompt += `\n\nAdditional guidance for this flurry: ${guidance}`;
  }
  return prompt;
}

// Expose to global scope
window.renderIdeaGrid = renderIdeaGrid;
window.bindCreativeProcessEvents = bindCreativeProcessEvents;