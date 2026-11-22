import { variableNames, bitsOf, evaluate } from './logic.mjs';

export function circuitHtml(task, inputs) {
  const width = 640;
  const count = task.terms.length;
  const gateHalfHeight = (task.variables - 1) * 12 + 12;
  const firstCenter = count === 1 ? 100 : gateHalfHeight + 25;
  const spacing = gateHalfHeight * 2 + 34;
  const height = Math.max(200, firstCenter * 2 + Math.max(0, count - 1) * spacing);
  const gateX = 150;
  const gateFlatEnd = 190;
  const gateEnd = gateFlatEnd + gateHalfHeight;
  const orX = 418;
  const orHalfHeight = Math.max(40, count * 4);
  const outX = 578;
  const center = count ? firstCenter + (count - 1) * spacing / 2 : height / 2;
  const output = evaluate(task, inputs);
  let content = '';
  const line = (path, high) => `<path d="${path}" class="wire${high ? ' high' : ''}"/>`;
  const text = (x, y, value, options = '') => `<text x="${x}" y="${y}" fill="#26384f" font-size="20" ${options}>${value}</text>`;
  if (!count) {
    content += text(122, center + 7, '0', 'font-weight="600"');
    content += line(`M145 ${center}H${outX}`, false);
  } else {
    task.terms.forEach((term, termIndex) => {
      const y = firstCenter + termIndex * spacing;
      const bits = bitsOf(term, task.variables);
      const active = bits.every((bit, i) => bit === inputs[i]);
      content += `<g class="minterm-circuit" data-minterm="${term}"><title>Minterm m${term}</title>`;
      bits.forEach((bit, i) => {
        const inputY = y - (task.variables - 1) * 12 + i * 24;
        content += text(32, inputY + 7, variableNames[i]);
        if (bit) {
          content += line(`M53 ${inputY}H${gateX}`, inputs[i]);
        } else {
          content += line(`M53 ${inputY}H90`, inputs[i]);
          content += line(`M116 ${inputY}H${gateX}`, !inputs[i]);
          content += `<g class="inverter" data-variable="${variableNames[i]}"><path d="M90 ${inputY - 10}L107 ${inputY}L90 ${inputY + 10}Z" class="gate"/><circle cx="112" cy="${inputY}" r="4" class="gate"/></g>`;
        }
      });
      content += `<path d="M${gateX} ${y - gateHalfHeight}H${gateFlatEnd}A${gateHalfHeight} ${gateHalfHeight} 0 0 1 ${gateFlatEnd} ${y + gateHalfHeight}H${gateX}Z" class="gate and-gate${active ? ' high' : ''}"/>`;
      if (count === 1) {
        content += line(`M${gateEnd} ${y}H${outX}`, active);
      } else {
        const distance = Math.abs(termIndex - (count - 1) / 2) / ((count - 1) / 2);
        const connectorX = 288 + distance * 62;
        const endY = center - orHalfHeight * .65 + termIndex * orHalfHeight * 1.3 / (count - 1);
        const endX = orX + 10 * (1 - ((endY - center) / orHalfHeight) ** 2);
        content += line(`M${gateEnd} ${y}H${connectorX}V${endY}H${endX}`, active);
      }
      content += '</g>';
    });
    if (count > 1) {
      content += `<path d="M${orX} ${center - orHalfHeight}Q${orX + 46} ${center - orHalfHeight} ${orX + 82} ${center}Q${orX + 46} ${center + orHalfHeight} ${orX} ${center + orHalfHeight}Q${orX + 20} ${center} ${orX} ${center - orHalfHeight}Z" class="gate or-gate${output ? ' high' : ''}"/>`;
      content += line(`M${orX + 82} ${center}H${outX}`, output);
    }
  }
  content += text(outX + 9, center + 7, 'Y');
  const description = count === 0 ? 'Konstantna funkcija' : count === 1 ? 'Jedna I vrata' : `${count} I vrata spojena na ILI vrata`;
  return `<svg class="circuit" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${description}. Izlaz Y je ${output}.">${content}</svg>`;
}
