let Redux = require("redux");
let { createStore, combineReducers } = Redux;

let codeEditorReducer = require("./reducers/code-editor-reducer");
let documentReducer = require("./reducers/document-reducer");

const reducers = { codeEditor: codeEditorReducer, doc: documentReducer, };

const livebookApp = combineReducers(reducers);
const livebookStore = createStore(livebookApp);
livebookStore.subscribe(codeEditorRender);
livebookStore.subscribe(notebookV2Render)

let EDITOR = {}

function codeEditorRender() {
  let { codeEditor } = livebookStore.getState();
  let { hidden, code, node, handleChange } = codeEditor;

  let {row, column} = (EDITOR.getCursorPosition && EDITOR.getCursorPosition()) || {row: 0, column: 0};

  if (hidden) {
    hideEditor();
    return;
  }

  let {top, left, height, width} = node.getBoundingClientRect();
  top += window.scrollY;

  summonEditor({
    code,
    height, width,
    top, left,
    row, column,
    change: handleChange,
  });
}

function notebookV2Render() {
  let { doc } = livebookStore.getState();
  let { html, codeList, codeMap } = doc;
  
  ReactDOM.render(
    <NotebookV2 
      errors={ERRORS}
      getCurrentPage={() => CurrentPage}
      startNewNotebook={startNewNotebook}
      renderLandingPage={renderLandingPage}
      store={livebookStore}
      html={html} codeList={codeList} codeMap={codeMap} 
      executePython={executePython}
      onUpdateNotebook={handleUpdateNotebook}
      hideCodeEditor={hideEditor}
      renderCodeEditor={summonEditor} />, 
    notebookV2Mount);
}

global.STORE = livebookStore;

var $          = require("jquery");
var ace        = require("brace");
var Range      = ace.acequire('ace/range').Range;
var React      = require("react");
var ReactDOM   = require("react-dom");
var AceEditor  = require("react-ace");

var cradle     = require("./cradle");

var colorChange = false

var {getCellPlots, setCellPlots} = require("./cell-plots-accessors");
var createCellPlotData = require("./cell-plots-adapter");


var NEXT_CALLBACK_FOR_RESULTS,
    NEXT_CALLBACK_FOR_PLOTS;
var WORKER     = new Worker("/js/worker.js");
WORKER.onmessage = function(e) {
  let data = e.data;
  let {results, plots, error} = data;

  console.log("Got message from the worker:", data)

  if (error) handleError(error);

  handlePlots(plots)
  handleResults(results)
}

function handleResults(results) {
  for (let cell in results) {
    // iPython.cells[cell].outputs = results[cell]
    NEXT_CALLBACK_FOR_RESULTS(cell, results[cell])
    delete ERRORS[cell]
  }
}

function handlePlots(plots) {
  for (let cell in plots) {
    let plotArrays = plots[cell];
    let plotData = createCellPlotData(plotArrays);
    NEXT_CALLBACK_FOR_PLOTS(cell, plotData);
  }
}

// Utils
var asyncRunParallel = require("./util").asyncRunParallel;
var createAsyncDataFetcher = require("./util").createAsyncDataFetcher;
var deepClone = require("./util").deepClone;
var getPixelsBeyondFold = require("./util").getPixelsBeyondFold;
var noop          = require("./util").noop;
var randomColor   = require("./util").randomColor;
var randomName    = require("./util").randomName;
var resultToHtml  = require("./util").resultToHtml;
var scrollXPixels = require("./util").scrollXPixels;
var {iPyToHTML} = require("./ipython-converter.jsx");


var getPeerColor     = (peer) => peer.state.color ;

function getSeniorPeerColors() {
  return cradle.peers().slice(1).filter((p) => p.senior).map(getPeerColor);
}

function getPeerColors() {
  return cradle.peers().slice(1).map(getPeerColor);
};

var getPeerEditing = (peer) => peer.state.editing;
var isPeerEditing = (peer) => { return (typeof getPeerEditing(peer)) === "number"; }
function getPeerEditingCells() {
  let otherPeers = cradle.peers().slice(1);
  return otherPeers.reduce((result, peer) => {
    if (isPeerEditing(peer)) {
      let peerClone = Object.assign({}, peer);
      peerClone.state = Object.assign({}, peer.state)
      result.push(peerClone);
    }
    return result;
  }, []);
}

var LAST_TYPE = new Date()
var TYPING_SPAN = 500
function typing(when) { return when - LAST_TYPE < TYPING_SPAN }

var ERRORS = {
  // expects this format:
  //
  // cellId: { cell: x, line: y, message: "hey"},
};

var ERROR_MARKER_IDS = []; // keeps track of the marker ids so we can remove them with `EDITOR.getSession().removeMarker(id)`
function REMOVE_ERRORS() {
  REMOVE_MARKERS();
  CLEAR_ERROR_MESSAGES();
}
function REMOVE_MARKERS() {
  ERROR_MARKER_IDS.forEach((id) => {
    EDITOR.getSession().removeMarker(id);
  });
  ERROR_MARKER_IDS = []
}
function CLEAR_ERROR_MESSAGES() {
  ERRORS = {};
}

cradle.onarrive = function() {
  update_peers_and_render();
}
cradle.ondepart = update_peers_and_render;
cradle.onupdate = update_peers_and_render;
cradle.onusergram = function(from,message) {
  console.log("on usergram")
  if (message && message.type == "update") {
    console.log("Got a new document... is it new?")
    if (message.time > iPythonUpdated) {
      iPythonUpdated = message.time
      iPython = message.document
      render()
    }
  }
}

function update_peers_and_render() {
  let peers = cradle.peers()

  if (colorChange === false && getSeniorPeerColors().indexOf(cradle.state.color) !== -1) {
    console.log("changing color once b/c someone else has seniority")
    cradle.setSessionVar("color", randomColor({ not: getPeerColors() }))
    colorChange = true
    peers = cradle.peers()
  }

  ReactDOM.render(<Nav 
      show={CurrentPage !== "landing"}
      peers={peers} 
      getCurrentPage={() => CurrentPage} 
      notebook={exports}/>, 
    navMount);

  let cursorPositions = peers.map((peer) => {
    let cursorPosition = peer.state.cursor === undefined ? 0 : peer.state.cursor; // FIXME
    return {
      position: cursorPosition,
      color: getPeerColor(peer),
    };
  });

  let peerEditingCells = getPeerEditingCells();

  let render_time = new Date();

  if (iPythonV2) {
    let {html,state} = iPythonV2
    livebookStore.dispatch({
      type: "INITIALIZE_DOCUMENT",
      documentProps: {
        codeMap: state.codeMap,
        codeList: state.codeList,
        html,
      },
    })
  } else {
    let {html, code} = iPyToHTML(iPython);
    livebookStore.dispatch({
      type: "INITIALIZE_DOCUMENT",
      documentProps: {
        codeMap: code,
        codeList: Object.keys(code),
        html,
      },
    })
  }
}

ace.config.set("basePath", "/");

var Pages = [ "landing", "notebook", "upload" ];
var CurrentPage = "notebook";
var iPython = { cells:[] }
var iPythonUpdated = 0
let iPythonV2

// React mount points
var landingPageMount   = document.getElementById("landing-page");
var notebookV2Mount    = document.getElementById("notebook-v2");
var editorMount        = document.getElementById("editor");
var navMount           = document.getElementById("nav");

function summonEditor(options) {
  let {row, column} = options;
  let {height, width} = options;
  let lang   = "python";
  let value  = options.code;
  let {change} =  options;
  let onBeforeLoad = noop;

  let editorOptions = {
    lang: lang,
    height: height,
    width: width,
    value: value,
    change: createChangeFunction(change), // TODO - scope with a function that evaluates contents
    onBeforeLoad: onBeforeLoad,
    onLoad: () => { if (EDITOR && EDITOR.moveCursorTo) EDITOR.moveCursorTo(row, column) },
  };

  ReactDOM.render(createAceEditor(editorOptions), editorMount);

  // Position editor
  let {top, left} = options;
  $("#editX")
    .css("top", top)
    .css("left", left)
    .show();

  EDITOR = ace.edit("editX")
  EDITOR.focus()
  EDITOR.moveCursorTo(row, column);
  EDITOR.getSession().setUseWrapMode(true);

  // TEMP for testing
  global.EDITOR = EDITOR;
  REMOVE_MARKERS();
}

function createChangeFunction(orig) {
  return handleChange;
  function handleChange(code) {
    orig(code);
  }
}

function hideEditor() {
  $("#editX").hide();
}

function createAceEditor(options) {
  options = Object.assign({}, options);
  var lang = options.lang,
      height = options.height,
      width = options.width,
      value = options.value,
      change = options.change,
      onBeforeLoad = options.onBeforeLoad,
      onLoad = options.onLoad;

  if (typeof height === "number") {
    height += "px";
  }
  if (typeof width === "number") {
    width += "px";
  }

  return (
    <AceEditor className="editor" name="editX"
      mode={lang} value={value}
      height={height} width={width}
      theme="github" onChange={change}
      showGutter={false}
      editorProps={{$blockScrolling: true,}}
      onBeforeLoad={onBeforeLoad} onLoad = {onLoad}/>
  );
}

function render() {
  let render_time = new Date()
  update_peers_and_render()

  return render_time
}

let SAVE_TIMEOUT;

function handleSaveNotebook(html,state) {
  if (document.location.pathname ===  "/") {
    // Stops 404 that results from posting to `/.json` on the starter page
    return;
  }
  console.log("Saving notebook...");
  var notebook = { version: 2, html, state } 
  var raw_notebook = JSON.stringify(notebook)
  var data = {
    name: "Hello",
    notebook: {
      name: "NotebookName",
      body: raw_notebook,
    },
  };
  $.ajax({
    method: "PUT",
    url: document.location + ".json",
    data: JSON.stringify(data),
    complete: function(response, status) {
      console.log("save response", response);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      // TODO handle errors
      console.log("Saving notebook failed:", textStatus);
    },
  });
}

function handleUpdateNotebook(html,state) {
  if (SAVE_TIMEOUT) { clearTimeout(SAVE_TIMEOUT) }
  SAVE_TIMEOUT = setTimeout(() => {
    SAVE_TIMEOUT = undefined
    handleSaveNotebook(html,state)
  },5000)
}

function setCurrentPage(page) {
  if (!Pages.includes(page)) {
    console.log("Error: '" + page + "' is not a valid page");
    return;
  }

  CurrentPage = page;
  render()
}

window.onpopstate = function(event) {
  var path = document.location.pathname;
  if (path === "/")
    setCurrentPage("landing");
  else if (path === "/upload")
    setCurrentPage("upload")
  else
    setCurrentPage("notebook")
}

function executePython(codeBlocks, nextForResults, nextForPlots) {
  NEXT_CALLBACK_FOR_RESULTS = nextForResults;
  NEXT_CALLBACK_FOR_PLOTS = nextForPlots;
  REMOVE_MARKERS()
  WORKER.postMessage({ type: "exec", doc: codeBlocks})
}

function handleError(e) {
  console.log("ERROR:",e)
  ERRORS[e.cell] = Object.assign({message: `${e.name}: ${e.message}`}, e);
  return e.cell
}

// this is to cache the code being edited so the pane does not update under the editor
var CODE = {
  cache: (i) => CODE[i] = iPython.cells[i].source.join("") + " ",
  clear: (i) => delete CODE[i],
  read:  (i) => CODE[i] || iPython.cells[i].source.join(""),
}

var Nav = require("./components/nav");
var LandingPage = require("./components/landing-page");
var Uploader = require("./components/uploader.jsx");
var NotebookV2 = require("./components/notebook-flowing.jsx");

function renderLandingPage() {
  ReactDOM.render(<LandingPage show={CurrentPage === "landing"} fork={forkNotebook} />, landingPageMount);
}

function forkNotebook(urls) {
  $.post("/fork/", JSON.stringify(urls), function(response) {
    window.location = response
  })
}

function parseRawNotebook(raw_notebook,raw_csv) {
  let notebook = JSON.parse(raw_notebook)
  if (notebook.version == 2) {
    iPythonV2 = notebook
  } else {
    iPython = notebook
    iPython.cells.forEach(cell => cell.outputs = [])
    iPythonUpdated = Date.now()
  }
  WORKER.postMessage({ type: "data", data: raw_csv })
}

function postNotebookToServer(raw_notebook,raw_csv, callback) {
  var doc = JSON.stringify({name: "Hello", notebook: { name: "NotebookName", body: raw_notebook } , datafile: { name: "DataName", body: raw_csv }})
  $.post("/d/", doc, function(response) {
    window.history.pushState({}, "Notebook", response);
    startCradle()
    callback()
  })
}

function startCradle() {
  cradle.join(document.location + ".rtc", function() {
    cradle.setSessionVar("cursor",0)
    cradle.setSessionVar("color", '#1E52AA')
    if (cradle.user.name == undefined) {
      cradle.setUserVar("name", randomName())
    } // else use old name
  })
}

function startNewNotebook(data) {
  postNotebookToServer(data.ipynb, data.csv, function() {
    parseRawNotebook(data.ipynb, data.csv);
    setCurrentPage("notebook");

    // I HOPE THIS WORKS
    update_peers_and_render();
  });
}

var exports =  {
  getCellPlots           : getCellPlots,
  getCODE                : () => CODE,
  getCurrentPage         : () => CurrentPage,
  getEditor              : () => EDITOR,
  getiPython             : () => iPython,
  setCurrentPage         : setCurrentPage,
};

global.MEH = exports;

if (/[/]d[/](\d*)$/.test(document.location)) {
  $.get(document.location + ".json",function(data) {
    parseRawNotebook(data.Notebook.Body, data.DataFile.Body);
    setCurrentPage("notebook");
    startCradle()
  }, "json")
} else {
  let isUploadPage = document.location.pathname.indexOf("upload") !== -1;
  isUploadPage ? setCurrentPage("upload") : setCurrentPage("landing");
}

module.exports = exports;
