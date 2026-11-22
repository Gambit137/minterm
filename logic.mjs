export const variableNames = ['A', 'B', 'C', 'D'];

export function bitsOf(index, variables) {
  return Array.from({ length: variables }, (_, i) => (index >> (variables - i - 1)) & 1);
}

export function parseTask(input, fallbackVariables = 3) {
  const value = input.trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/\s+/g, '');
  if (!value) throw new Error('Upiši minterme za svoj zadatak.');
  let indices;
  let combinations;
  const formal = value.match(/^(?:y=)?(?:1|[Σ∑](?:m)?)?\{([\d,;]*)\}(\d+)?$/i) || value.match(/^(?:y=)?[Σ∑](?:m)?\(([\d,;]*)\)(\d+)?$/i);
  if (formal) {
    indices = parseIndices(formal[1]);
    combinations = formal[2] ? Number(formal[2]) : null;
  } else if (/^\d+(?:[,;]\d+)*$/.test(value)) {
    indices = parseIndices(value);
  } else {
    throw new Error('Neispravan zapis. Primjer: y=1{0, 4, 7}8.');
  }
  if (combinations != null && ![4, 8, 16].includes(combinations)) throw new Error('Broj kombinacija na kraju zapisa mora biti 4, 8 ili 16.');
  const variables = combinations ? Math.log2(combinations) : fallbackVariables;
  if (![2, 3, 4].includes(variables)) throw new Error('Odaberi 2, 3 ili 4 varijable.');
  const limit = 2 ** variables;
  if (indices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= limit)) throw new Error(`Za ${variables} varijable mintermi su od 0 do ${limit - 1}.`);
  return { variables, terms: [...new Set(indices)].sort((a, b) => a - b) };
}

function parseIndices(value) {
  if (value === '') return [];
  if (!/^\d+(?:[,;]\d+)*$/.test(value)) throw new Error('Odvoji minterme zarezima, bez praznih mjesta između zareza.');
  return value.split(/[,;]/).map(Number);
}

export function formatTask(task) {
  return `y=1{${task.terms.join(', ')}}${2 ** task.variables}`;
}

export function truthRows(task) {
  const terms = new Set(task.terms);
  return Array.from({ length: 2 ** task.variables }, (_, index) => ({ index, bits: bitsOf(index, task.variables), output: Number(terms.has(index)) }));
}

export function evaluate(task, inputs) {
  const index = inputs.reduce((result, bit) => result * 2 + bit, 0);
  return Number(task.terms.includes(index));
}

export function randomTask(variables, previous = null, random = Math.random) {
  const count = 2 ** variables;
  let terms;
  for (let attempt = 0; attempt < 20; attempt++) {
    const size = 1 + Math.floor(random() * Math.min(count - 1, variables === 4 ? 7 : 5));
    const values = Array.from({ length: count }, (_, i) => i);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    terms = values.slice(0, size).sort((a, b) => a - b);
    if (!previous || previous.variables !== variables || terms.join() !== previous.terms.join()) break;
  }
  if (previous && previous.variables === variables && terms.join() === previous.terms.join()) {
    terms = terms.map(i => (i + 1) % count).sort((a, b) => a - b);
    if (terms.join() === previous.terms.join()) terms = [previous.terms.includes(0) ? 1 : 0];
  }
  return { variables, terms };
}
