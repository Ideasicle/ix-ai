// IX AI App JavaScript
console.log('DEBUG: script.js loading started at', new Date().toLocaleString());

const state = {
  sessionIdeas: [],
  lastIdeas: [],
  lastHallucinationLevel: 'buzzed',
  lastAiEngine: 'Grok',
  lastBrief: '',
  stage2Active: false,
  suppressWarning: false,
  refineIdeaIndex: null,
  generalFeedback: '',
  isLoading: false
};

const dom = {
  stage1: null,
  stage2: null,
  notification: null,
  generatePromptBtn: null,
  clearInputBtn: null,
  processBtn: null,
  miniCardsContainer: null,
  generatePdfBtn: null,
  noIdeas: null,
  ideaModal: null,
  modalIdeaContent: null,
  modalClose: null,
  modalApproveCheckbox: null,
  modalIdeaNotes: null,
  approvedCount: null,
  navInstructions: null,
  navTips: null,
  navSuggestionBox: null,
  instructionsModal: null,
  tipsModal: null,
  suggestionBoxModal: null,
  aiEngineModal: null,
  openAiEngineBtn: null,
  aiEngineName: null,
  aiEngineMessage: null,
  briefBuilderBtn: null,
  briefBuilderModal: null,
  saveBriefBtn: null,
  cancelBriefBtn: null,
  closeBriefBuilder: null,
  ideasContainer: null,
  stage2Actions: null,
  approvedIdeas: null,
  loadingModal: null,
  loadingMessage: null,
  progressBar: null,
  sparksContainer: null
};

function initializeDOMElements() {
  console.log('DEBUG: Initializing DOM elements at', new Date().toLocaleString());
  const missingElements = [];
  for (const key in dom) {
    dom[key] = document.getElementById(key);
    if (!dom[key]) missingElements.push(key);
  }
  if (missingElements.length) {
    console.error('Missing DOM elements: ' + missingElements.join(', '));
    showNotification('Missing elements: ' + missingElements.join(', ') + '. Some features may not work.', 'error', 5000);
  }
  if (!navigator.userAgent.includes('Chrome')) {
    showNotification('Please use Google Chrome for the best experience.', 'error', 5000);
  }
  const storedFeedback = localStorage.getItem('generalFeedback');
  if (storedFeedback) state.generalFeedback = storedFeedback;
}

function showNotification(message, type, duration = 3000) {
  if (!dom.notification) return console.error('Notification element missing');
  dom.notification.textContent = message;
  dom.notification.className = `notification ${type}`;
  dom.notification.style.display = 'block';
  setTimeout(() => dom.notification.style.display = 'none', duration);
}

function handleError(message, showToUser = true) {
  console.error('Error: ' + message);
  if (showToUser) showNotification('Error: ' + message, 'error', 5000);
}

function clearInfoBoxes(containerId) {
  const container = document.getElementById(containerId);
  if (container) Array.from(container.getElementsByClassName('info-box')).forEach(box => box.remove());
}

function resetApp(clearBrief = false) {
  state.sessionIdeas = [];
  state.lastIdeas = [];
  state.stage2Active = false;
  state.refineIdeaIndex = null;
  state.generalFeedback = '';
  state.isLoading = false;
  localStorage.removeItem('approvedIdeas');
  localStorage.removeItem('generalFeedback');
  if (clearBrief) {
    const briefInput = document.getElementById('briefInput');
    if (briefInput) briefInput.value = '';
    state.lastBrief = '';
    state.lastHallucinationLevel = 'buzzed';
    state.lastAiEngine = 'Grok';
    document.querySelector('input[name="hallucinationLevel"][value="buzzed"]').checked = true;
    document.querySelector('input[name="aiEngine"][value="Grok"]').checked = true;
  }
  const llmResponse = document.getElementById('llmResponse');
  if (llmResponse) llmResponse.value = '';
  if (dom.ideasContainer) dom.ideasContainer.innerHTML = '';
  if (dom.stage2Actions) dom.stage2Actions.style.display = 'none';
  if (dom.approvedIdeas) dom.approvedIdeas.style.display = 'none';
  if (dom.generatePromptBtn) {
    dom.generatePromptBtn.disabled = false;
    dom.generatePromptBtn.title = 'Generate a new prompt';
  }
  ['stage1', 'stage2'].forEach(clearInfoBoxes);
  updateMiniCards();
  updateApprovedCount();
  [dom.instructionsModal, dom.tipsModal, dom.suggestionBoxModal, dom.aiEngineModal, dom.ideaModal, dom.briefBuilderModal, dom.loadingModal].forEach(closeModal);
}

function updateApprovedCount() {
  if (dom.approvedCount) dom.approvedCount.textContent = state.sessionIdeas.length;
}

function generatePDF() {
  if (!state.sessionIdeas.length) return showNotification('No ideas to generate PDF', 'error', 5000);
  if (!window.jspdf || !window.jspdf.jsPDF) return handleError('jsPDF library not loaded.', true);
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('IX AI Approved Ideas', 20, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    let y = 30;

    const allApprovedIdeas = [...state.sessionIdeas];
    const storedIdeas = localStorage.getItem('approvedIdeas');
    if (storedIdeas) {
      JSON.parse(storedIdeas).forEach(storedIdea => {
        if (!allApprovedIdeas.some(idea => idea.title === storedIdea.title && idea.description === storedIdea.description && idea.reaction === storedIdea.reaction)) {
          allApprovedIdeas.push(storedIdea);
        }
      });
    }

    allApprovedIdeas.forEach(idea => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.text(`Idea #${idea.ideaNumber}${idea.reaction ? ' (Revised)' : ''}`, 20, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(idea.title || 'Untitled', 20, y, { maxWidth: 170 });
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      const descLines = doc.splitTextToSize(idea.description || 'No description', 170);
      doc.text(descLines, 20, y);
      y += descLines.length * 6 + 0.5;
      if (idea.rationale && idea.rationale.trim()) {
        doc.setFont('helvetica', 'bold');
        doc.text('Rationale:', 20, y);
        doc.setFont('helvetica', 'normal');
        const rationaleLines = doc.splitTextToSize(idea.rationale.replace(/[^ -~]/g, ''), 170);
        doc.text(rationaleLines, 20, y + 4);
        y += rationaleLines.length * 6 + 6;
      }
      if (idea.notes && idea.notes.trim()) {
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', 20, y);
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(idea.notes.replace(/[^ -~]/g, ''), 170);
        doc.text(notesLines, 20, y + 4);
        y += notesLines.length * 6 + 6;
      }
    });

    doc.save('IX_AI_Approved_Ideas.pdf');
    showNotification('PDF Generated', 'success', 3000);
  } catch (err) {
    handleError('PDF generation failed: ' + err.message, true);
  }
}

function generatePrompt(brief, mode = 'initial', idea = null) {
  if (!brief && mode !== 'refine' && mode !== 'new-ideas') throw new Error('No brief provided');
  const hallucinationLevel = document.querySelector('input[name="hallucinationLevel"]:checked')?.value;
  const aiEngine = document.querySelector('input[name="aiEngine"]:checked')?.value;
  if (!hallucinationLevel || !aiEngine) throw new Error('No hallucination level or AI engine selected');

  let cleanedBrief = brief || state.lastBrief;
  const briefStartIndex = cleanedBrief.indexOf('Type of idea:');
  if (briefStartIndex !== -1) cleanedBrief = cleanedBrief.substring(briefStartIndex);
  cleanedBrief = cleanedBrief.split('\n').filter(line => 
    !line.startsWith('You are') && !line.startsWith('Instructions for Creative Output') &&
    !line.startsWith('- Generate') && !line.startsWith('- Focus') &&
    !line.startsWith('- Draw') && !line.startsWith('- Ensure') && !line.startsWith('- Avoid')
  ).join('\n').trim();

  const cleanIdeaField = field => field ? field.replace(/\s+/g, ' ').replace(/\.\s+/g, '. ').trim() : '';

  const specificIdeaTypes = ['tagline', 'name', 'headline', 'stunt', 'slogan', 'motto', 'catchphrase'];
  const ideaType = specificIdeaTypes.find(type => cleanedBrief.toLowerCase().includes(type)) || 'advertising idea';
  const isSpecificIdeaType = ideaType !== 'advertising idea';

  const outputInstructions = isSpecificIdeaType ? `
Output instructions:
You MUST generate EXACTLY FIVE ${ideaType}s. Each ${ideaType} MUST be formatted as a single block with the fields "Title:", "Description:", and "Rationale:", separated by single newlines. The Title field MUST contain only the ${ideaType} itself. The Description MUST be a MAXIMUM of 3 sentences, explaining the ${ideaType}’s meaning, emotional appeal, or relevance to the brand, target audience, and message, without describing any specific advertising campaign or medium (e.g., do NOT mention billboards, TV commercials, or social media). The Rationale MUST be EXACTLY 1 sentence, explaining why the ${ideaType} is effective, with no citations or references (e.g., [1], [2]). Use the exact labels "Title:", "Description:", and "Rationale:" with colons, ensuring each label is bolded in the output (e.g., **Title:**). Do not use headers, numbers, bullet points, or any other separators between ${ideaType}s. Separate each ${ideaType} block with exactly two blank lines (double newlines). Do not include any introductions, conclusions, extra text, or formatting deviations. Each of the five ${ideaType}s MUST be distinct, avoiding overlap in wording or intent, and must align precisely with the creative brief’s brand, audience, and message. Any deviation from this format, including incorrect sentence counts, non-bolded labels, fewer/more than five ${ideaType}s, or including campaign details, will break the system, so follow it precisely.

Format for each ${ideaType}:
**Title:** [${ideaType}]
**Description:** [1-3 sentences explaining the ${ideaType}’s meaning or appeal]
**Rationale:** [Exactly 1 sentence explaining why the ${ideaType} is effective]
` : `
Output instructions:
You MUST generate EXACTLY FIVE advertising ideas. Each idea MUST be formatted as a single block with the fields "Title:", "Description:", and "Rationale:", separated by single newlines. The description MUST be a MAXIMUM of 3 sentences, where a sentence ends with a period, exclamation point, or question mark (can be fewer but not more), and MUST organically include the intended marketplace manifestation (e.g., a 30-second TV commercial, a social media post, an outdoor billboard) as part of the first sentence to clarify the execution medium, choosing any appropriate medium that best fits the concept while considering its conventions (e.g., timing for video, engagement for social media). The rationale MUST be EXACTLY 1 sentence, with no citations or references (e.g., [1], [2]). Use the exact labels "Title:", "Description:", and "Rationale:" with colons, ensuring each label is bolded in the output (e.g., **Title:**). Do not use headers, numbers, bullet points, or any other separators between ideas. Separate each idea block with exactly two blank lines (double newlines). Do not include any introductions, conclusions, extra text, or formatting deviations. Each of the five ideas MUST represent a radically different approach to the task, with no overlap in themes, media, or execution, and must avoid repeating concepts, themes, or executions from any previously provided ideas in this session. You MUST strictly adhere to the specific type of idea requested in the creative brief (e.g., names, ad campaigns, promotional ideas) and generate ONLY that type of idea, ensuring every idea aligns precisely with the requested idea type. If the creative brief specifies a particular medium (e.g., "30-second TV commercials"), all ideas MUST conform to that medium. If the brief does not specify a medium or uses broad terms like "advertising ideas," "advertising campaigns," or "communications ideas," generate a media-agnostic core concept (e.g., a character, setting, or theme) adaptable to multiple media, optionally suggesting a primary medium in the first sentence that best fits the concept, while still adhering to the specified idea type. Any deviation from this format, including incorrect sentence counts, non-bolded labels, fewer/more than five ideas, or generating ideas that do not match the specified idea type, will break the system, so follow it precisely.

Format for each idea:
**Title:** [Advertising Idea Title]
**Description:** [Maximum 3 sentences describing the idea, starting with the medium or core concept]
**Rationale:** [Exactly 1 sentence explaining why the idea is effective]
`;

  let prompt = '';

  if (mode === 'refine' && idea) {
    const cleanedTitle = cleanIdeaField(idea.title);
    const cleanedDescription = cleanIdeaField(idea.description);
    const cleanedRationale = cleanIdeaField(idea.rationale);
    prompt = `
Title: ${cleanedTitle || 'The Empty Desk Challenge'}
Description: ${cleanedDescription || 'An X post by the founder launches a provocative challenge: “Post a pic of your agency’s empty desks and tag us—Ideasicle X will DM you a free idea to fill the gap.” The post includes a stark image of a deserted office with the caption, “Nothing is unthinkable with our virtual talent,” linking to www.ideasiclex.'}
Rationale: ${cleanedRationale || 'The bold, empathetic call-out to layoffs creates buzz among agency execs, positioning Ideasicle X as a timely, actionable savior.'}
How would you like to refine the ${cleanedTitle || 'The Empty Desk Challenge'} idea? When we're finished refining this idea, type 'Summarize' for a concise summary of our discussion to copy back into the app.

Instructions for creative output:
This is a continuation of the existing LLM thread, so retain the context of the original creative brief and prior feedback.
Print the idea - title, description, rationale - and then ask the user "How would you like to refine the ${cleanedTitle || 'The Empty Desk Challenge'} idea? When we're finished refining this idea, type 'Summarize' for a concise summary of our discussion to copy back into the app."
Limit responses to 100 words unless the user requests specific outputs like names, taglines, or headlines.
Include in every response: "Type 'Summarize' for a concise summary of our discussion."
If the user inputs "Summarize," provide a plain-text summary of the refinement discussion (50-100 words), free of markdown, including any specific outputs requested (e.g., headlines, lists like next steps).
You are a sparring partner with the user, where the user may add a build to the idea or ask for extensions; do exactly what the user requests unless it conflicts with the brief, in which case explain why with clear reasoning.
With Refine Idea you do not need to conform to the strict structure in the original prompt, you can instead free form respond as appropriate to the user's request.
Feel free to ask clarifying questions if the user's direction is unclear, and propose creative suggestions to enhance the idea.
Store this refinement feedback for use in future idea generation, referencing it where relevant.
Engage with the user as if you are old colleagues, maintaining a fun and collaborative tone to develop an even better idea. But be succinct and clear. This is all business.
`;
  } else if (mode === 'initial') {
    let personaInstruction = '';
    switch (hallucinationLevel) {
      case 'none':
        personaInstruction = 'You are a strategic advertising expert tasked with creating conventional advertising ideas that strictly match the idea type specified in the creative brief (e.g., names, taglines, headlines, stunts), using established advertising principles.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions:
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief (e.g., if taglines are requested, generate only taglines with explanations; if names are requested, generate only names with explanations).
- Ensure each idea aligns with the brand, product, target audience, and message (if provided) in the brief, without introducing unrelated concepts or deviating from the requested idea type.
- If there is no target audience described, then default to all adults 21-60 years old.

${outputInstructions}`;
        break;
      case 'microdose':
        personaInstruction = 'You are a creative advertising expert tasked with creating practical, audience-focused advertising ideas that strictly match the idea type specified in the creative brief, enhancing conventional formats with subtle, innovative twists. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief, introducing subtle, practical enhancements to conventional ideas while maintaining high feasibility.
- If there is no specific idea type mentioned, then default to general advertising platforms that are media agnostic and could work in any medium.
- Focus on established advertising formats with minor, practical innovations that enhance the specified idea type without deviating from it.
- Draw inspiration from current cultural trends, audience data, and proven advertising strategies, avoiding surreal or speculative elements.
- Ensure ideas are highly feasible, cost-effective, and directly resonate with the target audience’s preferences and behaviors, while strictly adhering to the requested idea type.
- Avoid clichés, predictable approaches, or any ideas that do not match the specified idea type.

${outputInstructions}`;
        break;
      case 'buzzed':
        personaInstruction = 'You are a bold, award-winning creative director tasked with creating innovative advertising ideas that strictly match the idea type specified in the creative brief, enhancing conventional formats with subtle, innovative twists. Hallucination is allowed as long as you can rationalize the concepts against the creative brief. The ideas you come up with connect dots that normal humans would never think of. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief, blending unconventional elements with familiar formats to create achievable advertising concepts.
- If there is no specific idea type mentioned, then default to general advertising platforms that are media agnostic and could work in any medium.
- Develop ideas that blend familiar advertising formats with bold, unexpected elements (e.g., emerging tech like AR, cross-cultural references), but only within the scope of the specified idea type.
- Draw inspiration from diverse but recognizable sources, such as current pop culture, technology trends, or global movements, ensuring ideas are adventurous yet implementable and match the requested idea type.
- Ensure ideas push creative boundaries but remain anchored to the brand’s essence, audience expectations, and the specified idea type, with clear execution paths.
- Avoid overly surreal or impractical concepts, or any ideas that do not match the specified idea type.

${outputInstructions}`;
        break;
      case 'tripping':
        personaInstruction = 'You are a visionary artist tasked with creating groundbreaking advertising ideas that redefine advertising through surreal and innovative concepts. Hallucination is not only encouraged, it\'s mandatory, but try to rationalize the concepts against the creative brief. The more seemingly disconnected the dots you connect are, the better. The ideas you come up with connect dots that even the most creative humans would never think of. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- Generate EXACTLY FIVE ${ideaType}s that strictly adhere to the specified idea type in the creative brief, exploring surreal and uncharted creative territories while maintaining relevance to the brand and audience.
- Invent bold, unconventional formats or experiences that strictly adhere to the specified idea type, even if execution is speculative or futuristic.
- Draw inspiration from abstract sources like mythology, quantum physics, imagined futures, the arts, entertainment, or human consciousness, prioritizing imagination.
- Create ideas that challenge conventional advertising but remain relevant to the brief’s brand, audience, and message, without deviating from the specified idea type.
- Ensure ideas resonate emotionally or culturally with the audience, despite their unconventional nature, while strictly adhering to the requested idea type.

${outputInstructions}`;
        break;
      default:
        throw new Error('Invalid hallucination level selected');
    }
  } else if (mode === 'new-ideas') {
    const priorFeedback = state.sessionIdeas
      .filter(idea => idea.notes && idea.notes.trim())
      .map(idea => `Idea "${idea.title}": ${idea.notes}`)
      .join('\n');
    const generalFeedback = state.generalFeedback.trim() ? `General Feedback: ${state.generalFeedback}` : '';
    let personaInstruction = '';
    switch (hallucinationLevel) {
      case 'none':
        personaInstruction = 'You are a strategic advertising expert tasked with creating conventional advertising ideas that strictly match the idea type specified in the original creative brief, using established advertising principles.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- This is a continuation of the existing LLM thread, so retain the context of the original creative brief and prior feedback.
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief (e.g., taglines, names, headlines, stunts), ensuring alignment with the brand, product, target audience, and message.
- If there is no target audience described, then default to all adults 21-60 years old.
- Incorporate insights from prior refinement feedback (provided below) and general feedback (if provided) to inform the new ideas, and reference relevant feedback in the rationale of each idea.
- Pay close attention to the general feedback to shape the new ideas accordingly.
- Ensure each idea is distinct in theme, wording, or intent, avoiding overlap with previously generated ideas in this session.
- Follow the output format exactly, with no introductions, conclusions, or extra text.

Prior Feedback:
${priorFeedback || 'No prior feedback available.'}

${generalFeedback ? generalFeedback : 'No general feedback provided.'}

${outputInstructions}`;
        break;
      case 'microdose':
        personaInstruction = 'You are a creative advertising expert tasked with creating practical, audience-focused advertising ideas that strictly match the idea type specified in the original creative brief, enhancing conventional formats with subtle, innovative twists. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- This is a continuation of the existing LLM thread, so retain the context of the original creative brief and prior feedback.
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief, introducing subtle, practical enhancements to conventional ideas while maintaining high feasibility.
- If there is no specific idea type mentioned, then default to general advertising platforms that are media agnostic and could work in any medium.
- Incorporate insights from prior refinement feedback (provided below) and general feedback (if provided) to inform the new ideas, and reference relevant feedback in the rationale of each idea.
- Pay close attention to the general feedback to shape the new ideas accordingly.
- Focus on established advertising formats with minor, practical innovations, drawing inspiration from current cultural trends, audience data, and proven strategies, avoiding surreal or speculative elements.
- Ensure each idea is distinct in theme, wording, or intent, avoiding overlap with previously generated ideas in this session.
- Avoid clichés, predictable approaches, or any ideas that do not match the specified idea type.

Prior Feedback:
${priorFeedback || 'No prior feedback available.'}

${generalFeedback ? generalFeedback : 'No general feedback provided.'}

${outputInstructions}`;
        break;
      case 'buzzed':
        personaInstruction = 'You are a bold, award-winning creative director tasked with creating innovative advertising ideas that strictly match the idea type specified in the creative brief, enhancing conventional formats with subtle, innovative twists. Hallucination is allowed as long as you can rationalize the concepts against the creative brief. The ideas you come up with connect dots that normal humans would never think of. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- This is a continuation of the existing LLM thread, so retain the context of the original creative brief and prior feedback.
- Generate EXACTLY FIVE ${ideaType}s that strictly match the idea type specified in the creative brief, blending unconventional elements with familiar formats to create achievable advertising concepts.
- If there is no specific idea type mentioned, then default to general advertising platforms that are media agnostic and could work in any medium.
- Incorporate insights from prior refinement feedback (provided below) and general feedback (if provided) to inform the new ideas, and reference relevant feedback in the rationale of each idea.
- Pay close attention to the general feedback to shape the new ideas accordingly.
- Develop ideas that blend familiar advertising formats with bold, unexpected elements (e.g., emerging tech like AR, cross-cultural references), but only within the scope of the specified idea type.
- Ensure each idea is distinct in theme, wording, or intent, avoiding overlap with previously generated ideas in this session.
- Avoid overly surreal or impractical concepts, or any ideas that do not match the specified idea type.

Prior Feedback:
${priorFeedback || 'No prior feedback available.'}

${generalFeedback ? generalFeedback : 'No general feedback provided.'}

${outputInstructions}`;
        break;
      case 'tripping':
        personaInstruction = 'You are a visionary artist tasked with creating groundbreaking advertising ideas that redefine advertising through surreal and innovative concepts. Hallucination is not only encouraged, it\'s mandatory, but try to rationalize the concepts against the creative brief. The more seemingly disconnected the dots you connect are, the better. The ideas you come up with connect dots that even the most creative humans would never think of. You are also an expert in understanding the target audience described in the brief. If there is no target audience described, then default to all adults 21-60 years old.';
        prompt = `
${personaInstruction}

Creative brief:
${cleanedBrief}

Instructions for Creative Output:
- This is a continuation of the existing LLM thread, so retain the context of the original creative brief and prior feedback.
- Generate EXACTLY FIVE ${ideaType}s that strictly adhere to the specified idea type in the creative brief, exploring surreal and uncharted creative territories while maintaining relevance to the brand and audience.
- Incorporate insights from prior refinement feedback (provided below) and general feedback (if provided) to inform the new ideas, and reference relevant feedback in the rationale of each idea.
- Pay close attention to the general feedback to shape the new ideas accordingly.
- Invent bold, unconventional formats or experiences that strictly adhere to the specified idea type, even if execution is speculative or futuristic.
- Draw inspiration from abstract sources like mythology, quantum physics, imagined futures, the arts, entertainment, or human consciousness, prioritizing imagination.
- Ensure each idea is distinct in theme, wording, or intent, avoiding overlap with previously generated ideas in this session.
- Ensure ideas resonate emotionally or culturally with the audience, despite their unconventional nature, while strictly adhering to the requested idea type.

Prior Feedback:
${priorFeedback || 'No prior feedback available.'}

${generalFeedback ? generalFeedback : 'No general feedback provided.'}

${outputInstructions}`;
        break;
      default:
        throw new Error('Invalid hallucination level selected');
    }
  } else {
    throw new Error('Invalid mode or missing idea for refinement');
  }
  return prompt;
}

function showLoadingModal(callback, mode = 'initial') {
  if (!dom.loadingModal || !dom.loadingMessage || !dom.progressBar || !dom.sparksContainer) {
    handleError('Loading modal elements missing');
    return callback();
  }
  if (state.isLoading) {
    console.log('DEBUG: showLoadingModal skipped - already active');
    return;
  }
  state.isLoading = true;
  console.log('DEBUG: showLoadingModal started', new Date().toLocaleString());

  const stage3Messages = [
    'Summoning ancient spirits...',
    'Checking planet alignment...',
    'Leveraging current moon phase...',
    'Tapping into other dimensions...',
    'Feeling really good about this...',
    'Consulting the idea oracle...',
    'Chasing rogue inspirations...',
    'Brewing cosmic creativity...'
  ];

  const messages = mode === 'initial' ? [
    'Incorporating creative brief...',
    'Sprinkling hallucinogens...',
    stage3Messages[Math.floor(Math.random() * stage3Messages.length)],
    'Generating super prompt...',
    'Copying prompt to clipboard...'
  ] : [
    'Preparing refinement...',
    'Adding creative tweaks...',
    stage3Messages[Math.floor(Math.random() * stage3Messages.length)],
    'Finalizing prompt...',
    'Copying prompt to clipboard...'
  ];

  dom.loadingModal.style.display = 'block';
  dom.progressBar.style.transition = 'none';
  dom.progressBar.style.width = '0';
  dom.loadingMessage.textContent = '';
  dom.loadingMessage.classList.remove('active');
  dom.loadingMessage.setAttribute('aria-live', 'polite');
  dom.sparksContainer.innerHTML = '';

  const initialPause = 200;
  const stageDuration = 1200;
  let currentStage = 0;

  const createSpark = (xPercent) => {
    const spark = document.createElement('div');
    spark.className = 'spark';
    const colors = ['var(--primary-yellow)', 'var(--secondary-orange)', 'var(--primary-green)'];
    spark.style.background = colors[Math.floor(Math.random() * colors.length)];
    spark.style.left = `${xPercent}%`;
    spark.style.top = `${Math.random() * 20 - 10}px`;
    spark.style.transform = `scale(${0.5 + Math.random() * 1.5}) rotate(${Math.random() * 90 - 45}deg)`;
    dom.sparksContainer.appendChild(spark);
    setTimeout(() => spark.remove(), 1000);
  };

  const updateProgress = () => {
    if (currentStage >= messages.length) {
      dom.loadingModal.style.display = 'none';
      dom.progressBar.style.transition = 'none';
      dom.progressBar.style.width = '0';
      dom.loadingMessage.classList.remove('active');
      state.isLoading = false;
      console.log('DEBUG: showLoadingModal completed', new Date().toLocaleString());
      callback();
      return;
    }

    dom.loadingMessage.textContent = messages[currentStage];
    dom.loadingMessage.classList.add('active');

    dom.progressBar.style.transition = `width ${stageDuration / 1000}s linear`;
    dom.progressBar.style.width = `${(currentStage + 1) * 20}%`;

    const sparkCount = Math.floor(Math.random() * 11) + 20;
    const sparkInterval = stageDuration / sparkCount;
    for (let i = 0; i < sparkCount; i++) {
      const xPercent = (currentStage * 20) + (Math.random() * 20);
      setTimeout(() => createSpark(xPercent), i * sparkInterval);
    }

    currentStage++;
    setTimeout(updateProgress, stageDuration);
  };

  setTimeout(updateProgress, initialPause);
}

function showAiEngineModal(aiEngine, fullPrompt, mode = 'initial', ideaIndex = null) {
  if (!dom.openAiEngineBtn || !dom.aiEngineModal) return handleError('AI engine modal elements missing');
  const modalHeader = dom.aiEngineModal.querySelector('.modal-header');
  const openButton = dom.openAiEngineBtn;
  if (mode === 'refine' || mode === 'new-ideas') {
    modalHeader.textContent = 'Done!';
    openButton.textContent = 'Ready';
    openButton.setAttribute('aria-label', 'Close prompt modal');
    if (dom.aiEngineMessage) {
      dom.aiEngineMessage.textContent = `Your ${mode === 'refine' ? 'Refine Idea' : 'New Ideas'} prompt has been copied! Paste it as a response to your existing AI engine thread, copy the response, come back here, and click "Ready".`;
      if (dom.aiEngineName) dom.aiEngineName.style.display = 'none';
    }
  } else {
    modalHeader.textContent = 'Done!';
    openButton.textContent = 'Open AI Engine';
    openButton.setAttribute('aria-label', 'Open selected AI engine');
    if (dom.aiEngineMessage) {
      dom.aiEngineMessage.textContent = 'Click below to be magically transported to ' + (dom.aiEngineName ? aiEngine : 'your selected AI engine') + '. Paste your prompt, copy the entire response, and return here.';
      if (dom.aiEngineName) dom.aiEngineName.style.display = 'inline';
    }
  }
  const aiEngineUrls = {
    Grok: 'https://x.com/i/grok',
    ChatGPT: 'https://chat.openai.com',
    Perplexity: 'https://www.perplexity.ai'
  };
  openButton.onclick = () => {
    if (mode === 'refine' || mode === 'new-ideas') {
      closeModal(dom.aiEngineModal);
      if (mode === 'refine' && ideaIndex !== null) {
        const idea = state.lastIdeas[ideaIndex];
        if (idea) showIdeaModal(idea, ideaIndex);
      } else if (mode === 'new-ideas') {
        if (dom.stage2) {
          dom.stage2.style.display = 'block';
          window.scrollTo({ top: dom.stage2.offsetTop, behavior: 'smooth' });
        }
      }
    } else {
      window.open(aiEngineUrls[aiEngine] || aiEngineUrls.Grok, '_blank');
      closeModal(dom.aiEngineModal);
      if (dom.stage2) {
        dom.stage2.style.display = 'block';
        window.scrollTo({ top: dom.stage2.offsetTop, behavior: 'smooth' });
      }
    }
  };

  const copyWithRetry = (text, retries = 3) => {
    if (retries === 0) {
      handleError('Failed to copy prompt after retries. Copy manually from console.', true);
      console.log('Manual prompt: ' + text);
      return callback();
    }
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showNotification('Prompt copied. Paste it into ' + aiEngine + '.', 'success', 5000);
          if (mode === 'initial') {
            showLoadingModal(() => showModal(dom.aiEngineModal), mode);
          } else {
            showModal(dom.aiEngineModal);
          }
        }).catch(err => {
          console.warn('Clipboard copy failed, retrying...', err);
          setTimeout(() => copyWithRetry(text, retries - 1), 100);
        });
      } else {
        copyPromptFallback(text, aiEngine);
      }
    } catch (err) {
      handleError('Clipboard error: ' + err.message, true);
      setTimeout(() => copyWithRetry(text, retries - 1), 100);
    }
  };

  copyWithRetry(fullPrompt);
}

function copyPromptFallback(fullPrompt, aiEngine) {
  const textarea = document.createElement('textarea');
  textarea.value = fullPrompt;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showNotification('Prompt copied. Paste it into ' + aiEngine + '.', 'success', 5000);
    showLoadingModal(() => showModal(dom.aiEngineModal), 'initial');
  } catch (err) {
    handleError('Failed to copy prompt. Copy manually from console.', true);
    console.log('Manual prompt: ' + fullPrompt);
  }
  document.body.removeChild(textarea);
}

function parseLLMResponse(text) {
  const ideas = { newIdeas: [], revisedIdeas: [] };
  const blocks = text.replace(/\r\n|\r/g, '\n').trim().split(/\n{2,}/).filter(block => block.trim());
  let revisedIdeaNumber = 1;
  let newIdeaNumber = state.sessionIdeas.length + 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const idea = { ideaNumber: '', title: '', description: '', rationale: '', reaction: '', notes: '' };
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    let currentField = null;
    const tempFields = { title: [], description: [], rationale: [], reaction: [] };

    for (const line of lines) {
      if (line.match(/^\*\*Title:\*\*/i)) {
        currentField = 'title';
        tempFields.title.push(line.replace(/^\*\*Title:\*\*/i, '').trim());
      } else if (line.match(/^\*\*Description:\*\*/i)) {
        currentField = 'description';
        tempFields.description.push(line.replace(/^\*\*Description:\*\*/i, '').trim());
      } else if (line.match(/^\*\*Rationale:\*\*/i)) {
        currentField = 'rationale';
        tempFields.rationale.push(line.replace(/^\*\*Rationale:\*\*/i, '').trim());
      } else if (line.match(/^\*\*Reaction\s*to\s*feedback:\*\*/i)) {
        currentField = 'reaction';
        tempFields.reaction.push(line.replace(/^\*\*Reaction\s*to\s*feedback:\*\*/i, '').trim());
      } else if (currentField) {
        tempFields[currentField].push(line.trim());
      }
    }

    idea.title = tempFields.title.join(' ').trim() || 'Idea ' + (tempFields.reaction.length ? revisedIdeaNumber : newIdeaNumber);
    idea.description = tempFields.description.join(' ').trim().replace(/\s+\./g, '.').replace(/\s+/g, ' ') || 'No description provided.';
    idea.rationale = tempFields.rationale.join(' ').trim().replace(/\[\d+\]/g, '') || '';
    idea.reaction = tempFields.reaction.join(' ').trim() || '';

    if (idea.description && idea.description !== 'No description provided.') {
      const sentences = idea.description.split(/[.!?]+/).filter(s => s.trim()).slice(0, 3).join('. ').trim();
      idea.description = sentences && !/[.!?]$/.test(sentences) ? sentences + '.' : sentences || idea.description;
    }

    if (idea.title || idea.description !== 'No description provided.' || idea.rationale) {
      if (idea.reaction) {
        idea.ideaNumber = revisedIdeaNumber.toString();
        revisedIdeaNumber++;
        ideas.revisedIdeas.push(idea);
      } else if (ideas.newIdeas.length < 5) {
        idea.ideaNumber = newIdeaNumber.toString();
        newIdeaNumber++;
        ideas.newIdeas.push(idea);
      }
    }
  }

  if (!ideas.newIdeas.length && !ideas.revisedIdeas.length) {
    showNotification('No valid ideas found. Check AI response format.', 'error', 5000);
  }
  return ideas;
}

function renderIdeas(ideas) {
  if (!dom.ideasContainer) return handleError('Ideas container not found');
  dom.ideasContainer.innerHTML = '';
  if (!ideas.length) {
    dom.ideasContainer.innerHTML = '<p>No ideas found. Check AI response format.</p>';
    return;
  }

  let newIdeaCounter = state.sessionIdeas.length + 1;
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const isRevised = !!idea.reaction;
    const card = document.createElement('div');
    card.className = 'idea-card' + (isRevised ? ' revised' : '');

    const h3 = document.createElement('h3');
    h3.textContent = `Idea #${isRevised ? idea.ideaNumber : newIdeaCounter}${isRevised ? ' (Revised)' : ''}`;
    card.appendChild(h3);

    const titleP = document.createElement('p');
    titleP.className = 'title';
    titleP.innerHTML = '<strong>Title:</strong> ' + (idea.title || 'Untitled');
    card.appendChild(titleP);

    if (idea.reaction) {
      const reactionP = document.createElement('p');
      reactionP.innerHTML = '<strong>Reaction to feedback:</strong> ' + idea.reaction;
      card.appendChild(reactionP);
    }

    const descP = document.createElement('p');
    descP.innerHTML = '<strong>Description:</strong> ' + (idea.description || 'No description');
    card.appendChild(descP);

    if (idea.rationale && idea.rationale.trim()) {
      const rationaleP = document.createElement('p');
      rationaleP.innerHTML = '<strong>Rationale:</strong> ' + idea.rationale;
      card.appendChild(rationaleP);
    }

    const approveDiv = document.createElement('div');
    approveDiv.className = 'approve-checkbox';

    const approveLabel = document.createElement('label');
    const approveCheckbox = document.createElement('input');
    approveCheckbox.type = 'checkbox';
    approveCheckbox.id = `approve-${i}`;
    approveCheckbox.className = 'approve-idea';
    approveCheckbox.setAttribute('aria-label', 'Approve Idea');
    approveLabel.appendChild(approveCheckbox);
    approveLabel.appendChild(document.createTextNode(' Approve'));
    approveDiv.appendChild(approveLabel);

    const refineButton = document.createElement('button');
    refineButton.type = 'button';
    refineButton.id = `refine-${i}`;
    refineButton.className = 'refine-btn';
    refineButton.setAttribute('aria-label', 'Refine Idea');
    refineButton.innerHTML = '<i class="fas fa-lightbulb"></i>Refine Idea';
    approveDiv.appendChild(refineButton);

    card.appendChild(approveDiv);

    approveCheckbox.addEventListener('click', e => {
      e.stopPropagation();
      const ideaData = {
        ideaNumber: isRevised ? idea.ideaNumber : newIdeaCounter.toString(),
        title: idea.title || 'Untitled',
        description: idea.description || 'No description',
        rationale: idea.rationale || '',
        reaction: idea.reaction || '',
        notes: idea.notes || ''
      };
      if (approveCheckbox.checked) {
        saveAndDisplayMiniCards([ideaData]);
        showIdeaModal(idea, i);
      } else {
        state.sessionIdeas = state.sessionIdeas.filter(stored => 
          stored.title !== ideaData.title || stored.description !== ideaData.description || stored.reaction !== ideaData.reaction);
        updateMiniCards();
      }
    });

    refineButton.addEventListener('click', e => {
      e.stopPropagation();
      state.refineIdeaIndex = i;
      if (!state.sessionIdeas.some(stored => 
        stored.title === idea.title && stored.description === idea.description && stored.reaction === idea.reaction)) {
        const ideaData = {
          ideaNumber: isRevised ? idea.ideaNumber : newIdeaCounter.toString(),
          title: idea.title || 'Untitled',
          description: idea.description || 'No description',
          rationale: idea.rationale || '',
          reaction: idea.reaction || '',
          notes: idea.notes || ''
        };
        saveAndDisplayMiniCards([ideaData]);
        approveCheckbox.checked = true;
      }
      const fullPrompt = generatePrompt('', 'refine', idea);
      showAiEngineModal(state.lastAiEngine, fullPrompt, 'refine', i);
    });

    dom.ideasContainer.appendChild(card);
    if (!isRevised) newIdeaCounter++;
  }

  const feedbackContainer = document.createElement('div');
  feedbackContainer.className = 'feedback-container';
  feedbackContainer.innerHTML = `
    <h3>General Feedback</h3>
    <p class="step-instructions">Type in any feedback to the ideas above that we should take into consideration when coming up with new ideas.</p>
    <textarea id="generalFeedback" rows="4" placeholder="Enter general feedback for new ideas..." aria-label="General feedback for new ideas"></textarea>
  `;
  dom.ideasContainer.appendChild(feedbackContainer);

  const generalFeedbackTextarea = document.getElementById('generalFeedback');
  if (generalFeedbackTextarea) {
    generalFeedbackTextarea.value = state.generalFeedback;
    generalFeedbackTextarea.addEventListener('input', () => {
      state.generalFeedback = generalFeedbackTextarea.value.trim();
      try {
        localStorage.setItem('generalFeedback', state.generalFeedback);
      } catch (err) {
        handleError('Failed to save general feedback to storage: ' + err.message, true);
      }
    });
  }

  const newIdeasButton = document.createElement('button');
  newIdeasButton.className = 'primary-btn';
  newIdeasButton.innerHTML = '<i class="fas fa-lightbulb"></i> Generate New Ideas';
  newIdeasButton.setAttribute('aria-label', 'Generate New Ideas');
  newIdeasButton.addEventListener('click', () => {
    const fullPrompt = generatePrompt('', 'new-ideas');
    showAiEngineModal(state.lastAiEngine, fullPrompt, 'new-ideas');
  });
  dom.ideasContainer.appendChild(newIdeasButton);

  state.stage2Active = true;
  if (dom.stage2) dom.stage2.style.display = 'block';
  if (dom.stage2Actions) dom.stage2Actions.style.display = 'block';
  if (dom.approvedIdeas) dom.approvedIdeas.style.display = 'block';
  if (dom.generatePromptBtn) {
    dom.generatePromptBtn.disabled = true;
    dom.generatePromptBtn.title = 'Change settings or clear brief to enable';
  }
  if (dom.ideasContainer) window.scrollTo({ top: dom.ideasContainer.offsetTop, behavior: 'smooth' });
}

function processIdeas(text) {
  const parsedIdeas = parseLLMResponse(text);
  if (!parsedIdeas.newIdeas.length && !parsedIdeas.revisedIdeas.length) {
    showNotification('No valid ideas found. Check AI response format.', 'error', 5000);
    return;
  }
  state.lastIdeas = parsedIdeas.revisedIdeas.concat(parsedIdeas.newIdeas);
  renderIdeas(state.lastIdeas);
  showNotification('Ideas Processed Successfully', 'success', 3000);
}

function saveAndDisplayMiniCards(ideas) {
  const uniqueIdeas = ideas.filter(idea => !state.sessionIdeas.some(stored => 
    stored.title === idea.title && stored.description === idea.description && stored.reaction === idea.reaction));
  state.sessionIdeas = uniqueIdeas.concat(state.sessionIdeas);

  let allApprovedIdeas = [...state.sessionIdeas];
  const storedIdeas = localStorage.getItem('approvedIdeas');
  if (storedIdeas) {
    try {
      JSON.parse(storedIdeas).forEach(storedIdea => {
        if (!allApprovedIdeas.some(idea => idea.title === storedIdea.title && idea.description === storedIdea.description && storedIdea.reaction === idea.reaction)) {
          allApprovedIdeas.push(storedIdea);
        }
      });
    } catch (err) {
      console.error('Error parsing stored ideas: ' + err.message);
    }
  }
  try {
    localStorage.setItem('approvedIdeas', JSON.stringify(allApprovedIdeas));
  } catch (err) {
    handleError('Failed to save ideas to storage', true);
  }

  updateMiniCards();
  updateApprovedCount();
  if (dom.approvedIdeas) dom.approvedIdeas.style.display = 'block';
}

function updateMiniCards() {
  if (!dom.miniCardsContainer || !dom.noIdeas || !dom.generatePdfBtn) return handleError('Mini-cards elements missing');
  dom.miniCardsContainer.innerHTML = '';
  dom.noIdeas.style.display = state.sessionIdeas.length ? 'none' : 'block';
  dom.generatePdfBtn.style.display = state.sessionIdeas.length ? 'block' : 'none';
  state.sessionIdeas.forEach((idea, index) => {
    const card = document.createElement('div');
    card.className = 'mini-card' + (idea.reaction ? ' revised' : '');
    card.dataset.index = index;
    card.innerHTML = '<p>' + (idea.title || 'Untitled') + '</p>';
    card.addEventListener('click', () => showIdeaModal(idea, index));
    dom.miniCardsContainer.appendChild(card);
  });
}

function showIdeaModal(idea, index) {
  if (!dom.modalIdeaContent || !dom.modalIdeaNotes || !dom.modalApproveCheckbox || !dom.ideaModal) return handleError('Modal elements missing');
  dom.modalIdeaContent.innerHTML = `
    <h3>Idea #${idea.ideaNumber}${idea.reaction ? ' (Revised)' : ''}</h3>
    <p class="title"><strong>Title:</strong> ${idea.title || 'Untitled'}</p>
    ${idea.reaction ? `<p><strong>Reaction to feedback:</strong> ${idea.reaction}</p>` : ''}
    <p><strong>Description:</strong> ${idea.description || 'No description'}</p>
    ${idea.rationale && idea.rationale.trim() ? `<p><strong>Rationale:</strong> ${idea.rationale}</p>` : ''}
    <div class="approve-checkbox">
      <label><input type="checkbox" id="modal-approve-checkbox" class="approve-idea" aria-label="Approve Idea"> Approve</label>
    </div>`;
  dom.modalIdeaContent.dataset.index = index;
  dom.modalIdeaNotes.value = idea.notes || '';
  dom.modalApproveCheckbox.checked = state.sessionIdeas.some(stored => 
    stored.title === idea.title && stored.description === idea.description && stored.reaction === idea.reaction);

  const saveNotes = () => {
    const index = parseInt(dom.modalIdeaContent.dataset.index);
    if (index >= 0 && index < state.sessionIdeas.length) {
      state.sessionIdeas[index].notes = dom.modalIdeaNotes.value.trim();
      try {
        localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
      } catch (err) {
        handleError('Failed to save idea notes to storage: ' + err.message, true);
      }
    }
  };

  dom.modalIdeaNotes.addEventListener('input', saveNotes);
  dom.modalIdeaNotes.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const cleanedText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();
    dom.modalIdeaNotes.value = cleanedText;
    saveNotes();
  }, { once: true });

  const approveCheckbox = dom.modalIdeaContent.querySelector('#modal-approve-checkbox');
  approveCheckbox.addEventListener('click', () => {
    const ideaData = {
      ideaNumber: idea.ideaNumber,
      title: idea.title || 'Untitled',
      description: idea.description || 'No description',
      rationale: idea.rationale || '',
      reaction: idea.reaction || '',
      notes: dom.modalIdeaNotes.value.trim() || ''
    };
    if (approveCheckbox.checked) {
      saveAndDisplayMiniCards([ideaData]);
    } else {
      state.sessionIdeas = state.sessionIdeas.filter(stored => 
        stored.title !== ideaData.title || stored.description !== ideaData.description || stored.reaction !== ideaData.reaction);
      updateMiniCards();
    }
  });

  showModal(dom.ideaModal);
  const firstInput = dom.ideaModal.querySelector('textarea');
  if (firstInput) firstInput.focus();
}

function showModal(modal) {
  if (!modal) return handleError('Modal element missing');
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
  const backdrop = modal.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => closeModal(modal), { once: true });
  }
  if (modal.id === 'briefBuilderModal') {
    const firstInput = dom.briefBuilderModal.querySelector('#briefIdeaType');
    if (firstInput) firstInput.focus();
  }
}

function closeModal(modal) {
  if (!modal) return handleError('Modal element missing');
  if (modal.id === 'ideaModal' && dom.modalIdeaContent && dom.modalIdeaNotes) {
    const index = parseInt(dom.modalIdeaContent.dataset.index);
    if (index >= 0 && index < state.sessionIdeas.length) {
      state.sessionIdeas[index].notes = dom.modalIdeaNotes.value.trim();
      try {
        localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
      } catch (err) {
        handleError('Failed to save idea notes to storage: ' + err.message, true);
      }
    }
  }
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
  state.isLoading = false;
}

function buildBrief() {
  const fields = ['briefIdeaType', 'briefBrandProduct', 'briefTargetAudience', 'briefMessage', 'briefAdditionalInfo'];
  let brief = '';
  fields.forEach(id => {
    const value = document.getElementById(id);
    if (value && value.value.trim()) {
      brief += id.replace('brief', '') + ': ' + value.value.trim() + '\n';
    }
  });
  return brief.trim();
}

function showWarningPrompt(callback) {
  if (state.suppressWarning || sessionStorage.getItem('suppressWarning')) return callback();
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <p>Generating a new prompt will clear current ideas. Continue?</p>
      <label><input type="checkbox" id="dontShowAgain" aria-label="Don't show warning again"> Don't show again</label>
      <div class="button-group">
        <button id="confirmWarning" class="primary-btn" aria-label="Confirm">Confirm</button>
        <button id="cancelWarning" class="secondary-btn" aria-label="Cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);

  document.getElementById('confirmWarning').addEventListener('click', () => {
    if (document.getElementById('dontShowAgain').checked) {
      sessionStorage.setItem('suppressWarning', 'true');
      state.suppressWarning = true;
    }
    document.body.removeChild(dialog);
    callback();
  });

  document.getElementById('cancelWarning').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
}

function resetPromptState() {
  if (dom.generatePromptBtn) {
    dom.generatePromptBtn.disabled = false;
    dom.generatePromptBtn.title = 'Generate a new prompt';
  }
  state.stage2Active = false;
}

document.addEventListener('DOMContentLoaded', () => {
  initializeDOMElements();

  const bindButton = (element, action, label) => {
    if (element) {
      element.addEventListener('click', () => {
        try {
          action();
        } catch (err) {
          handleError(`Error in ${label} action: ${err.message}`, true);
        }
      });
    }
  };

  bindButton(dom.generatePromptBtn, () => {
    const briefInput = document.getElementById('briefInput');
    if (!briefInput || !briefInput.value.trim()) return showNotification('Enter a creative brief', 'error', 5000);
    const hallucinationLevel = document.querySelector('input[name="hallucinationLevel"]:checked');
    const aiEngine = document.querySelector('input[name="aiEngine"]:checked');
    if (!hallucinationLevel || !aiEngine) return showNotification('Select hallucination level and AI engine', 'error', 5000);
    const fullPrompt = generatePrompt(briefInput.value.trim(), 'initial');
    const copyPrompt = () => {
      state.lastBrief = briefInput.value.trim();
      state.lastHallucinationLevel = hallucinationLevel.value;
      state.lastAiEngine = aiEngine.value;
      resetPromptState();
      showAiEngineModal(state.lastAiEngine, fullPrompt, 'initial');
    };
    if (state.stage2Active && (state.lastBrief !== briefInput.value.trim() || state.lastHallucinationLevel !== hallucinationLevel.value || state.lastAiEngine !== aiEngine.value)) {
      showWarningPrompt(() => copyPrompt());
    } else {
      copyPrompt();
    }
  }, 'Generate Prompt');

  bindButton(dom.navInstructions, () => showModal(dom.instructionsModal), 'Nav Instructions');
  bindButton(dom.navTips, () => showModal(dom.tipsModal), 'Nav Tips');
  bindButton(dom.navSuggestionBox, () => {
    window.location.href = 'mailto:willb@ideasiclex.com?subject=IX AI Suggestions';
    showModal(dom.suggestionBoxModal);
  }, 'Nav Suggestion Box');

  bindButton(dom.briefBuilderBtn, () => {
    ['briefIdeaType', 'briefBrandProduct', 'briefTargetAudience', 'briefMessage', 'briefAdditionalInfo']
      .forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
    showModal(dom.briefBuilderModal);
  }, 'Brief Builder');

  bindButton(dom.saveBriefBtn, () => {
    const brief = buildBrief();
    if (brief) {
      const briefInput = document.getElementById('briefInput');
      if (briefInput) {
        briefInput.value = brief;
        showNotification('Brief saved', 'success', 3000);
      } else {
        handleError('Creative Brief input not found');
      }
    } else {
      showNotification('Fill at least one field', 'error', 5000);
    }
    closeModal(dom.briefBuilderModal);
  }, 'Save Brief');

  bindButton(dom.cancelBriefBtn, () => closeModal(dom.briefBuilderModal), 'Cancel Brief');

  document.querySelectorAll('.modal-close-btn').forEach(btn => 
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')))
  );

  bindButton(dom.clearInputBtn, () => {
    resetApp(true);
    resetPromptState();
    showNotification('Input Cleared', 'success', 3000);
  }, 'Clear Input');

  bindButton(dom.processBtn, () => {
    const llmResponse = document.getElementById('llmResponse');
    if (!llmResponse || !llmResponse.value.trim()) return showNotification('Paste an AI response', 'error', 5000);
    processIdeas(llmResponse.value.trim());
  }, 'Process');

  bindButton(dom.generatePdfBtn, generatePDF, 'Generate PDF');

  bindButton(dom.modalClose, () => {
    const index = parseInt(dom.modalIdeaContent.dataset.index);
    if (index >= 0 && index < state.sessionIdeas.length) {
      state.sessionIdeas[index].notes = dom.modalIdeaNotes.value.trim();
      try {
        localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
      } catch (err) {
        handleError('Failed to save idea notes to storage: ' + err.message, true);
      }
    }
    closeModal(dom.ideaModal);
    showNotification('Idea Saved', 'success', 3000);
  }, 'Modal Save');

  bindButton(dom.modalApproveCheckbox, () => {
    const index = parseInt(dom.modalIdeaContent.dataset.index);
    if (!dom.modalApproveCheckbox.checked) {
      state.sessionIdeas.splice(index, 1);
      try {
        localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
      } catch (err) {
        handleError('Failed to save ideas to storage', true);
      }
      updateMiniCards();
      updateApprovedCount();
      closeModal(dom.ideaModal);
      showNotification('Idea Unapproved', 'success', 3000);
    } else {
      if (index >= 0 && index < state.sessionIdeas.length) {
        state.sessionIdeas[index].notes = dom.modalIdeaNotes.value.trim();
        try {
          localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
        } catch (err) {
          handleError('Failed to save idea notes to storage', true);
        }
      }
    }
  }, 'Modal Approve Checkbox');

  if (dom.modalIdeaNotes) {
    dom.modalIdeaNotes.addEventListener('input', () => {
      const index = parseInt(dom.modalIdeaContent.dataset.index);
      if (index >= 0 && index < state.sessionIdeas.length) {
        state.sessionIdeas[index].notes = dom.modalIdeaNotes.value.trim();
        try {
          localStorage.setItem('approvedIdeas', JSON.stringify(state.sessionIdeas));
        } catch (err) {
          handleError('Failed to save idea notes to storage: ' + err.message, true);
        }
      }
    });
  }

  document.querySelectorAll('input[name="hallucinationLevel"], input[name="aiEngine"]').forEach(radio => {
    radio.addEventListener('click', resetPromptState);
  });

  const briefInput = document.getElementById('briefInput');
  if (briefInput) briefInput.addEventListener('input', resetPromptState);

  window.addEventListener('beforeunload', e => {
    if (state.sessionIdeas.length) {
      e.preventDefault();
      e.returnValue = 'Don’t forget to create a PDF!';
    }
  });
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}