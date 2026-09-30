// Utilidades mínimas de DOM. Las vistas se construyen una vez y luego solo se
// actualizan los textos y clases que cambian, para no perder toques en botones.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function setClass(el, cls, on) {
  if (el.classList.contains(cls) !== Boolean(on)) el.classList.toggle(cls, Boolean(on));
}

export function setDisabled(el, disabled) {
  if (el.disabled !== disabled) el.disabled = disabled;
}

export function setWidth(el, fraction) {
  const pct = `${(Math.max(0, Math.min(1, fraction)) * 100).toFixed(1)}%`;
  if (el.style.width !== pct) el.style.width = pct;
}
