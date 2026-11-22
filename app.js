import { circuitHtml } from './circuit.mjs';
import { variableNames, bitsOf, parseTask, formatTask, truthRows, evaluate, randomTask } from './logic.mjs';

const labels = ['Tablica', 'Jedinice', 'Mintermi', 'Funkcija', 'Shema'];
const solverPanel = document.getElementById('panel-solver');
const practicePanel = document.getElementById('panel-practice');
let solverTask = { variables: 3, terms: [0, 4, 7] };
let draftVariables = 3;
let practiceVariables = 3;
let practiceTask = randomTask(practiceVariables);
let answers = [];
let checked = false;
let revealed = false;
let solverView;
let practiceView;

function announce(message) {
  const target = document.getElementById('announcer');
  target.textContent = '';
  requestAnimationFrame(() => { target.textContent = message; });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function termHtml(index) {
  return `m<sub>${index}</sub>`;
}

function productHtml(index, variables) {
  return bitsOf(index, variables).map((bit, i) => `<span${bit ? '' : ' class="neg"'}>${variableNames[i]}</span>`).join('<span class="product-dot"> · </span>');
}

function productSpeech(index, variables) {
  return bitsOf(index, variables).map((bit, i) => `${bit ? '' : 'negacija '}${variableNames[i]}`).join(' i ');
}

function taskHtml(task) {
  return `y = 1{${task.terms.join(', ')}}<sub>${2 ** task.variables}</sub>`;
}

function variableSelector(id, selected) {
  return `<div class="segmented" role="group" aria-label="Broj varijabli">${[2, 3, 4].map(n => `<button type="button" class="${n === selected ? 'active' : ''}" data-${id}-vars="${n}" aria-pressed="${n === selected}">${n}</button>`).join('')}</div>`;
}

function mountSolver() {
  solverPanel.innerHTML = `<div class="workspace"><aside class="sidebar"><section class="card input-card"><h2 class="card-heading">Tvoj zadatak</h2><form id="solver-form" class="solver-form" novalidate><div class="variable-field"><span class="field-label" id="solver-vars-label">Broj varijabli</span>${variableSelector('solver', draftVariables)}</div><div class="task-field"><label class="field-label" for="task-input">Zapis funkcije</label><div class="input-wrap"><input id="task-input" class="task-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="input-error" value="${escapeHtml(formatTask(solverTask))}"></div><p id="input-error" class="input-error" role="alert" hidden></p></div><button class="primary-button" type="submit">Riješi zadatak</button></form></section></aside><div class="working-area"><div id="solver-solution"></div></div></div>`;
  solverView = new SolutionView(document.getElementById('solver-solution'), solverTask);
  document.getElementById('solver-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const error = document.getElementById('input-error');
    try {
      solverTask = parseTask(input.value, draftVariables);
      draftVariables = solverTask.variables;
      error.hidden = true;
      input.setAttribute('aria-invalid', 'false');
      input.value = formatTask(solverTask);
      updateVariableButtons('solver', draftVariables);
      solverView.destroy();
      solverView = new SolutionView(document.getElementById('solver-solution'), solverTask);
      announce(`Zadatak je riješen. ${solverTask.variables} varijable, ${solverTask.terms.length} minterma. Prvi korak: tablica istinitosti.`);
      if (matchMedia('(max-width: 760px)').matches) document.getElementById('solver-solution').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  });
  document.getElementById('task-input').addEventListener('input', () => {
    document.getElementById('input-error').hidden = true;
    document.getElementById('task-input').setAttribute('aria-invalid', 'false');
  });
  solverPanel.querySelectorAll('[data-solver-vars]').forEach(button => button.addEventListener('click', () => {
    draftVariables = Number(button.dataset.solverVars);
    updateVariableButtons('solver', draftVariables);
    const input = document.getElementById('task-input');
    input.value = input.value.replace(/([})])\s*\d+\s*$/, `$1${2 ** draftVariables}`);
    document.getElementById('input-error').hidden = true;
    input.setAttribute('aria-invalid', 'false');
  }));
}

function updateVariableButtons(prefix, selected) {
  document.querySelectorAll(`[data-${prefix}-vars]`).forEach(button => {
    const active = Number(button.getAttribute(`data-${prefix}-vars`)) === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class SolutionView {
  constructor(root, task) {
    this.root = root;
    this.task = task;
    this.step = 0;
    this.timer = null;
    this.running = false;
    this.inputs = Array(task.variables).fill(0);
    root.innerHTML = `<section class="card solution-card" aria-label="Rješenje zadatka"><nav class="steps" aria-label="Koraci rješenja">${labels.map((label, i) => `<button type="button" class="step${i === 0 ? ' active' : ''}" data-step="${i}" aria-label="${i + 1}. ${label}" ${i === 0 ? 'aria-current="step"' : ''}><span>${i + 1}</span>${label}</button>`).join('')}</nav><div class="stage" aria-live="polite" aria-atomic="true"></div><div class="step-navigation"><div class="nav-start"><button class="text-button play-button" type="button">Animiraj</button><span class="step-count">1 od 5</span></div><div style="display:flex;gap:7px"><button class="text-button prev-button" type="button" disabled>Natrag</button><button class="text-button next-button" type="button">Sljedeći korak</button></div></div></section>`;
    this.stage = root.querySelector('.stage');
    this.prev = root.querySelector('.prev-button');
    this.next = root.querySelector('.next-button');
    this.play = root.querySelector('.play-button');
    this.count = root.querySelector('.step-count');
    this.buttons = [...root.querySelectorAll('[data-step]')];
    this.buttons.forEach(button => button.addEventListener('click', () => this.go(Number(button.dataset.step))));
    this.prev.addEventListener('click', () => this.go(this.step - 1));
    this.next.addEventListener('click', () => this.go(this.step === 4 ? 0 : this.step + 1));
    this.play.addEventListener('click', () => {
      if (this.running) this.stop();
      else {
        if (this.step === 4) this.show(0);
        this.running = true;
        this.updatePlay();
        this.schedule();
      }
    });
    this.renderStage();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.step < 4) this.show(this.step + 1);
      if (this.step === 4) this.stop();
      else if (this.running) this.schedule();
    }, this.step === 0 ? 2800 : this.step === 2 ? Math.min(6500, 2200 + this.task.terms.length * 350) : 3200);
  }

  go(step) {
    this.stop();
    this.show(Math.max(0, Math.min(4, step)));
  }

  show(step) {
    this.step = step;
    this.buttons.forEach((button, i) => {
      button.classList.toggle('active', i === step);
      button.classList.toggle('completed', i < step);
      button.firstElementChild.textContent = i + 1;
      if (i === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    this.prev.disabled = step === 0;
    this.next.textContent = step === 4 ? 'Ispočetka' : 'Sljedeći korak';
    this.count.textContent = `${step + 1} od 5`;
    this.renderStage();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.updatePlay();
  }

  updatePlay() {
    this.play.textContent = this.running ? 'Pauziraj' : 'Animiraj';
    this.play.setAttribute('aria-pressed', String(this.running));
  }

  destroy() {
    this.stop();
  }

  renderStage() {
    this.stage.style.animation = 'none';
    void this.stage.offsetWidth;
    this.stage.style.animation = '';
    const headings = ['Tablica istinitosti', 'Zaokružene jedinice', 'Tablica i mintermi', 'Tvoja funkcija', 'Logička shema'];
    this.stage.innerHTML = `<div class="stage-heading"><h3>${headings[this.step]}</h3></div>`;
    if (this.step < 2) {
      this.stage.insertAdjacentHTML('beforeend', tableHtml(this.task, this.step === 1));
      if (this.step === 1) this.stage.insertAdjacentHTML('beforeend', `<p class="table-legend"><span class="legend-square" aria-hidden="true"></span>${this.task.terms.length ? 'Svaka jedinica daje jedan minterm' : 'Nema jedinica · funkcija je uvijek 0'}</p>`);
    } else if (this.step === 2) {
      this.stage.insertAdjacentHTML('beforeend', tableHtml(this.task, true, false, true));
    } else if (this.step === 3) {
      this.stage.insertAdjacentHTML('beforeend', `<div class="formula-display" aria-label="Funkcija kao zbroj minterma"><span>y =</span>${sumHtml(this.task, false)}</div><div class="function-connection" aria-hidden="true"><svg viewBox="0 0 20 30"><path d="M10 0v22m-5-5 5 5 5-5"/></svg></div><div class="formula-display function-result" aria-label="Razvijeni oblik funkcije"><span>y =</span>${sumHtml(this.task, true)}</div>`);
    } else {
      this.stage.insertAdjacentHTML('beforeend', `<div class="input-controls" role="group" aria-label="Ulazi logičke sheme">${this.inputs.map((value, i) => `<button class="signal-toggle${value ? ' on' : ''}" type="button" data-input="${i}" aria-label="Ulaz ${variableNames[i]}" aria-pressed="${Boolean(value)}">${variableNames[i]}<span class="signal-value">${value}</span></button>`).join('')}<span class="output-pill${evaluate(this.task, this.inputs) ? ' on' : ''}">Izlaz Y = <strong>${evaluate(this.task, this.inputs)}</strong></span></div><div class="circuit-wrap" role="region" aria-label="Logička shema"><div class="circuit-content">${circuitHtml(this.task, this.inputs)}</div></div>`);
      this.stage.querySelectorAll('[data-input]').forEach(button => button.addEventListener('click', () => {
        const index = Number(button.dataset.input);
        this.inputs[index] = 1 - this.inputs[index];
        button.classList.toggle('on', Boolean(this.inputs[index]));
        button.setAttribute('aria-pressed', String(Boolean(this.inputs[index])));
        button.querySelector('.signal-value').textContent = this.inputs[index];
        const output = evaluate(this.task, this.inputs);
        const pill = this.stage.querySelector('.output-pill');
        pill.classList.toggle('on', Boolean(output));
        pill.querySelector('strong').textContent = output;
        this.stage.querySelector('.circuit-content').innerHTML = circuitHtml(this.task, this.inputs);
        announce(`Ulaz ${variableNames[index]} je ${this.inputs[index]}. Izlaz Y je ${output}.`);
      }));
    }
  }
}

function sumHtml(task, expanded) {
  if (!task.terms.length) return '<span>0</span>';
  return task.terms.map(term => `<span class="formula-term"${expanded ? ` role="math" aria-label="${productSpeech(term, task.variables)}"` : ''}>${expanded ? productHtml(term, task.variables) : termHtml(term)}</span>`).join('<span class="operator">+</span>');
}

function tableHtml(task, circle = false, exercise = false, withMinterms = false) {
  const rows = truthRows(task).map((row, i) => {
    const output = exercise
      ? `<button type="button" class="answer-bit${answers[i] === 1 ? ' value-one' : ''}${checked ? answers[i] === row.output ? ' correct' : ' wrong' : ''}" data-answer="${i}" aria-label="Izlaz y za redak ${i}: ${answers[i] == null ? 'nije odabrano' : answers[i]}" ${answers[i] == null ? '' : `aria-pressed="${answers[i] === 1}"`}>${answers[i] ?? '–'}</button>`
      : `<span class="bit${row.output ? ' target-bit' : ''}${row.output && circle ? ' circled' : ''}" style="--delay:${Math.min(i * 90, 1000)}ms">${row.output}</span>`;
    const minterm = row.output
      ? `<span class="row-minterm" role="math" aria-label="Minterm m${row.index} jednak je ${productSpeech(row.index, task.variables)}"><span class="minterm-index">${termHtml(row.index)} =</span><span class="minterm-product">${productHtml(row.index, task.variables)}</span></span>`
      : '';
    return `<tr class="${row.output && !exercise ? `one-row${circle ? ' focus-row' : ''}` : ''}" style="--delay:${i * 25}ms"><td>${row.index}</td>${row.bits.map(bit => `<td>${bit}</td>`).join('')}<td class="output-cell">${output}</td>${withMinterms ? `<td class="minterm-cell">${minterm}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="table-wrap${withMinterms ? ' with-minterms' : ''}" style="--table-width:${170 + task.variables * 52}px;--minterm-width:${130 + task.variables * 28}px;--table-min-width:${200 + task.variables * 52}px"${withMinterms ? ' tabindex="0" role="region" aria-label="Tablica s mintermima, pomična vodoravno"' : ''}><table class="truth-table"><thead><tr><th scope="col" aria-label="Redak">m</th>${variableNames.slice(0, task.variables).map(name => `<th scope="col">${name}</th>`).join('')}<th scope="col" class="output-header">y</th>${withMinterms ? '<th scope="col" class="minterm-header">Minterm</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function mountPractice() {
  answers = Array(2 ** practiceTask.variables).fill(null);
  checked = false;
  revealed = false;
  practiceView?.destroy();
  practiceView = null;
  practicePanel.innerHTML = `<div class="practice-workspace"><aside class="sidebar"><section class="card input-card"><h2 class="card-heading">Nasumični zadatak</h2><div class="practice-sidebar-form"><span class="field-label">Broj varijabli</span>${variableSelector('practice', practiceVariables)}<span class="field-label">Tvoj izazov</span><div class="practice-task">${taskHtml(practiceTask)}</div><button id="new-task" class="primary-button" type="button">Novi zadatak</button></div></section></aside><div class="working-area"><section class="card exercise-card"><div class="practice-input-head"><h2>Tablica istinitosti</h2></div><div class="exercise-table">${tableHtml(practiceTask, false, true)}</div><div class="exercise-actions"><button id="check-answers" class="primary-button" type="button">Provjeri rješenje</button><button id="reveal-solution" class="reveal-button" type="button">Prikaži postupak</button></div><div id="practice-feedback" role="status" aria-live="polite"></div></section><div id="practice-reveal" class="practice-reveal" hidden><h3 class="reveal-title">Rješenje zadatka</h3><div id="practice-solution"></div></div></div></div>`;
  practicePanel.querySelectorAll('[data-practice-vars]').forEach(button => button.addEventListener('click', () => {
    practiceVariables = Number(button.dataset.practiceVars);
    practiceTask = randomTask(practiceVariables, practiceTask);
    mountPractice();
    practicePanel.querySelector(`[data-practice-vars="${practiceVariables}"]`).focus({ preventScroll: true });
    announce(`Novi zadatak s ${practiceVariables} varijable.`);
  }));
  document.getElementById('new-task').addEventListener('click', () => {
    practiceTask = randomTask(practiceVariables, practiceTask);
    mountPractice();
    document.getElementById('new-task').focus({ preventScroll: true });
    announce('Generiran je novi zadatak.');
  });
  practicePanel.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.answer);
    answers[index] = answers[index] == null ? 0 : 1 - answers[index];
    button.textContent = answers[index];
    button.setAttribute('aria-label', `Izlaz y za redak ${index}: ${answers[index]}`);
    button.setAttribute('aria-pressed', String(answers[index] === 1));
    button.classList.toggle('value-one', answers[index] === 1);
    if (checked) {
      checked = false;
      practicePanel.querySelectorAll('[data-answer]').forEach(b => b.classList.remove('wrong', 'correct'));
      document.getElementById('practice-feedback').innerHTML = '';
    }
  }));
  document.getElementById('check-answers').addEventListener('click', checkAnswers);
  document.getElementById('reveal-solution').addEventListener('click', showPracticeSolution);
}

function checkAnswers() {
  const missing = answers.filter(answer => answer == null).length;
  const feedback = document.getElementById('practice-feedback');
  if (missing) {
    feedback.innerHTML = `<div class="feedback warning"><span>Još ${missing} ${missing === 1 ? 'redak čeka' : missing < 5 ? 'retka čekaju' : 'redaka čeka'} tvoj odgovor.</span></div>`;
    const button = practicePanel.querySelector(`[data-answer="${answers.indexOf(null)}"]`);
    button.focus({ preventScroll: true });
    return;
  }
  checked = true;
  const rows = truthRows(practiceTask);
  const right = rows.filter((row, index) => row.output === answers[index]).length;
  practicePanel.querySelectorAll('[data-answer]').forEach(button => {
    const index = Number(button.dataset.answer);
    const correct = rows[index].output === answers[index];
    button.classList.toggle('correct', correct);
    button.classList.toggle('wrong', !correct);
    button.setAttribute('aria-label', `Izlaz y za redak ${index}: ${answers[index]}, ${correct ? 'točno' : 'netočno'}`);
  });
  const success = right === rows.length;
  feedback.innerHTML = `<div class="feedback ${success ? 'success' : 'warning'}"><span>${success ? 'Sve je točno! Tvoja tablica je spremna.' : `${right} od ${rows.length} točnih. Pokušaj ponovno s označenim redcima.`}${success && revealed ? ' Postupak je već prikazan.' : ''}</span></div>`;
  if (success) showPracticeSolution(false);
}

function showPracticeSolution(scroll = true) {
  if (!revealed) {
    revealed = true;
    document.getElementById('practice-reveal').hidden = false;
    practiceView = new SolutionView(document.getElementById('practice-solution'), practiceTask);
    document.getElementById('reveal-solution').textContent = 'Postupak je prikazan';
  }
  if (scroll !== false) document.getElementById('practice-reveal').scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

function activateTab(name) {
  const solver = name === 'solver';
  solverPanel.hidden = !solver;
  practicePanel.hidden = solver;
  ['solver', 'practice'].forEach(id => {
    const active = id === name;
    const button = document.getElementById(`tab-${id}`);
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  if (solver) practiceView?.stop();
  else solverView.stop();
}

document.querySelectorAll('[role="tab"]').forEach(button => {
  button.addEventListener('click', () => activateTab(button.id.replace('tab-', '')));
  button.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'solver' : event.key === 'End' ? 'practice' : button.id === 'tab-solver' ? 'practice' : 'solver';
      activateTab(next);
      document.getElementById(`tab-${next}`).focus();
    }
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    solverView.stop();
    practiceView?.stop();
  }
});

mountSolver();
mountPractice();
