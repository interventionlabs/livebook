// Overlay:
// CodeCell: 
// Placeholder: 
const { eventFire } = require("../util");
const { isDown } = require("./util");

module.exports = {
    codeCellToPlaceholder,
    cutSelectedCodeCell,
    deleteSelectedCodeCell,
    editSelectedCodeCell,
    focusOnSelectedOverlay,
    getSelectedPlaceholder,
    goToNextCodeCell,
    handleCodeCellArrowKeyEvent,
    highlightSelectedCodeCell,
    isCodeCellSelected,
};

function goToNextCodeCell(editor) {
  let placeholder = getSelectedPlaceholder();
  if (!placeholder) return;
  let nextParent = placeholder.parentNode.nextElementSibling;
  let next = nextParent.querySelector("img");
  if (next) editor.selectElement(next);
  highlightSelectedCodeCell(editor);
}

function handleCodeCellArrowKeyEvent(editor, { event }) {
  if (isDown(event)) {
    let codeCell = getSelectedCodeCell();
    let placeholder = codeCellToPlaceholder(codeCell);
    if (isLastEditorCell(placeholder)) {
      addProseBelow(editor, placeholder);      
    }
  }
}

function addProseBelow(editor, placeholder) {
  pasteBelowPlaceholder(editor, placeholder, "<p><br/></p>");
}

function pasteBelowPlaceholder(editor, placeholder, html) {
  let placeholderParent = placeholder.parentNode;
  editor.selectElement(placeholderParent);
  editor.pasteHTML(placeholderParent.outerHTML + html);
  highlightSelectedCodeCell(editor);
}

function isLastEditorCell(placeholder) {
  let placeholderParent = placeholder.parentNode;
  return !placeholderParent.nextElementSibling;
}

function editSelectedCodeCell() {
  let selected = getSelectedCodeCell();
  let code = findCode(selected);
  eventFire(code, "click");
}

function findCode(elt) {
  return elt.querySelector(".code");
}

function cutSelectedCodeCell(editor) {
  let placeholder = getSelectedPlaceholder();
  editor.selectElement(placeholder);
  editor.selectElement(editor.getSelectedParentElement());
  editor.execAction("cut");
}

function deleteSelectedCodeCell(editor) {
  let placeholder = getSelectedPlaceholder();
  editor.selectElement(placeholder);
  editor.selectElement(editor.getSelectedParentElement());
  editor.execAction("delete");
}

function highlightSelectedCodeCell(editor) {
  let selectedParent = editor.getSelectedParentElement();
  let placeholder = selectedParent.querySelector("img[data-livebook-placeholder-cell]");

  removeAllCodeCellHighlights();

  if (placeholder) {
    addCodeCellHighlight(placeholderToCodeCell(placeholder));
  }
}

function removeAllCodeCellHighlights() {
  const activeCodeCells = [].slice.call(document.querySelectorAll(".active-code-cell"));
  activeCodeCells.forEach(removeCodeCellHighlight)
}

function addCodeCellHighlight(elt) {
  elt.classList.add("active-code-cell");
}

function removeCodeCellHighlight(elt) {
  elt.classList.remove("active-code-cell");
}


function codeCellToPlaceholder(codeCell) {
  let id = codeCell.id.replace("overlay", "");
  let placeholder = document.getElementById("placeholder" + id);
  return placeholder;
}

function focusOnSelectedOverlay(editor) {
  let codeCell = getSelectedCodeCell();
  if (!codeCell) return;
  let placeholder = codeCellToPlaceholder(codeCell);
  editor.selectElement(placeholder);
}

function getSelectedCodeCell() {
  return document.querySelector(".active-code-cell");
}

function getSelectedPlaceholder() {
  let overlay = getSelectedCodeCell();
  return codeCellToPlaceholder(overlay);
}

function isCodeCellSelected() {
  return !!getSelectedCodeCell();
}

function placeholderToCodeCell(placeholder) {
  let id = placeholder.id.replace("placeholder", "");
  let codeCell = document.getElementById("overlay" + id);
  return codeCell;
}