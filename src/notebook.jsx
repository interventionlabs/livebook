require("./stylesheets/notebook.scss");

const Redux = require("redux");
const { createStore, combineReducers } = Redux;

const documentReducer = require("./reducers/document-reducer");

const reducers = { doc: documentReducer};

const livebookApp = combineReducers(reducers);
const livebookStore = createStore(livebookApp);
livebookStore.subscribe(navRender);
livebookStore.subscribe(notebookRender)
livebookStore.subscribe(runNotebook)
livebookStore.subscribe(saveNotebook)


const COLOR_MAP = require("./util").COLOR_MAP;

let START = Date.now()
let EDITOR = {}

function mark(id,str) {
  console.log("MARK " + (Date.now() - START)/1000.0 + ": " + id + " :: " + str)
}

let LAST_CODE = []// changes in results dont bug me - nested reducers maybe?
function runNotebook() {
  let {doc} = livebookStore.getState()
  if (doc.editor !== "me" && doc.editor !== undefined) return; // someone else did the update - let them run it
  let codeBlocks = doc.codeList.map((id) => doc.codeMap[id])
  if (LAST_CODE.join() != codeBlocks.join()) {
    REMOVE_MARKERS()
    mark(doc.editID, "SEND_TO_WORKER")
    WORKER.postMessage({ type: "exec", doc: codeBlocks, editID: doc.editID })
    LAST_CODE = codeBlocks
  }
}

function saveNotebook() {
  let {doc} = livebookStore.getState()
  if (doc.html === "") return; // inital state - ignore
  if (doc.editor !== "me") return; // someone else did the update (or undefined)

  // yuck...
  // If there's a pending update - change the SAVE_FUNC
  if (SAVE_TIMEOUT) {
    SAVE_FUNC = () => {
      handleSaveNotebook(doc)
      handleSyncNotebook(doc)
    }
  } else {
    // IF NOT - blank out the SAVE_FUNC and start a timer - this way nothing happens if this
    // is the final update - but a proper save happens in 500ms if it isn't
    SAVE_FUNC = () => {}
    SAVE_TIMEOUT = setTimeout(() => {
      SAVE_TIMEOUT = undefined
      SAVE_FUNC()
    }, 500)
    handleSaveNotebook(doc)
    handleSyncNotebook(doc)
  }
}

function empty(x) {
  return Object.keys(x).length == 0
}

// These are functions that are assigned by children 
// (effectively passing functionality from children to parents, which is a React no-no)
let uglyAntiFunctions = {};
global.uglyAntiFunctions = uglyAntiFunctions;

function notebookRender() {
  const state = livebookStore.getState();
  const { doc } = livebookStore.getState();

  ReactDOM.render(
    <Notebook 
      getColor={getColor}
      doc={doc}
      startNewNotebook={startNewNotebook}
      store={livebookStore}
      getPeers={() => cradle.peers() }
      assignForceUpdate={(f) => uglyAntiFunctions.forceUpdateEditor = f}
      assignFocusOnSelectedOverlay={(f) => uglyAntiFunctions.focusOnSelectedOverlay = f}
      assignFocusEditorOnPlaceholder={(f) => uglyAntiFunctions.focusEditorOnPlaceholder = f}
      focusEditorOnPlaceholder={ (i) => uglyAntiFunctions.focusEditorOnPlaceholder && uglyAntiFunctions.focusEditorOnPlaceholder(i) } 
      focusOnSelectedOverlay={ () => uglyAntiFunctions.focusOnSelectedOverlay && uglyAntiFunctions.focusOnSelectedOverlay() } />, 
    notebookMount);
}

function getColor() {
  let peers = cradle.peers();
  let color = peers[0] && peers[0].state.color;
  if (color) {
    return color;
  }
  return ""; // default?
}

function navRender() {
  ReactDOM.render(<Nav render={render} store={livebookStore} getPeers={() => cradle.peers() } getColor={getColor} />, navMount);
}

global.STORE = livebookStore;

var $          = require("jquery");
var React      = require("react");
var ReactDOM   = require("react-dom");

var cradle     = require("./cradle");

var colorChange = false

var {getCellPlots, setCellPlots} = require("./cell-plots-accessors");
var createCellPlotData = require("./cell-plots-adapter");

var WORKER = new Worker("/js/worker.js");
WORKER.onmessage = function(e) {
  let data = e.data;
  let {index, results, plots, error, locals} = data;

  livebookStore.dispatch({ type: "NEW_RESULTS", index, results, plots, locals, error })

  let { forceUpdateEditor } = uglyAntiFunctions;
  forceUpdateEditor && forceUpdateEditor();
}

// Utils
var randomColor   = require("./util").randomColor;
var randomName    = require("./util").randomName;
var {iPyToHTML} = require("./ipython-converter.jsx");


var getPeerColor     = (peer) => peer.state.color ;

function getSeniorPeerColors() {
  return cradle.peers().slice(1).filter((p) => p.senior).map(getPeerColor);
}

function getPeerColors() {
  return cradle.peers().slice(1).map(getPeerColor);
};

var LAST_TYPE = new Date()
var TYPING_SPAN = 500
function typing(when) { return when - LAST_TYPE < TYPING_SPAN }

var ERROR_MARKER_IDS = []; // keeps track of the marker ids so we can remove them with `EDITOR.getSession().removeMarker(id)`
function REMOVE_MARKERS() {
  ERROR_MARKER_IDS.forEach((id) => {
    EDITOR.getSession().removeMarker(id);
  });
  ERROR_MARKER_IDS = []
}

function ifChanged(key,val,func) {
  let flatVal = typeof val == 'object' ? JSON.stringify(val) : val
  if (ifChanged[key] !== flatVal) {
    ifChanged[key] = flatVal
    func(val)
  }
}

cradle.onupdate = function() {

  var colorMap = COLOR_MAP.lines;

  let peers = cradle.peers().map((p) => ({session: p.session, color: p.state.color, cursor: p.state.cursor, name: p.user.name }))
  let style = peers.filter((p) => p.session && p.color).map((p) => "[data-livebook-sessions*='"+p.session+"'] { background: "+ colorMap[p.color]+"; }\n").join('')

  set_avatar_colors()

  ifChanged("style", style, () => {
    let css = document.getElementById("peers-style");
    css.innerHTML = style
  })

  ifChanged("cursors",peers,() => {
    peers.filter((p) => p.session && p.cursor).map((p) => {
      let nodes = [].slice.call(document.querySelectorAll("[data-livebook-sessions*='"+p.session+"']"))
      nodes.forEach((domNode) => {
        domNode.dataset.livebookSessions = domNode.dataset.livebookSessions.replace(p.session, "");
      });

      let node = document.querySelector("[livebook-node-id='"+p.cursor+"']");
      if (node) node.dataset.livebookSessions = (node.dataset.livebookSessions || "") + p.session;
    })
    notebookRender()
  })
}

cradle.onarrive = update_peers_and_render;
cradle.ondepart = update_peers_and_render;
cradle.onusergram = function(from,message) {
  if (message && message.type == "update") {
    console.log("onusergram update, from ", from)
    livebookStore.dispatch({ type: "INITIALIZE_DOCUMENT", documentProps: message.doc, editor: from })
  }
}

function set_avatar_colors() {
  let peers = cradle.peers()
  if (colorChange === false && getSeniorPeerColors().indexOf(cradle.state.color) !== -1) {
    let color = randomColor({ not: getPeerColors() });
    console.log("=====")
    console.log("%cHEY THIS IS THE RANDOM AVATAR COLOR", "color:%color%;".replace("%color%", color));
    console.log(color);
    console.log("=====");

    cradle.setSessionVar("color", color)
    colorChange = true
  }
}
function update_peers_and_render() {
  let peers = cradle.peers()

  set_avatar_colors()

  navRender();

  let render_time = new Date();

  renderUploader();
}


var Pages = [ "landing", "notebook", "upload" ];
var CurrentPage = "notebook";

// React mount points
var notebookMount      = document.getElementById("notebook");
var navMount           = document.getElementById("nav");
var uploaderMount      = document.getElementById("uploader");

function render() {
  let render_time = new Date()
  update_peers_and_render()
  return render_time
}

let SAVE_TIMEOUT;
let SAVE_FUNC;

function handleSyncNotebook(state) {
  cradle.broadcast({type:"update",time:Date.now(), doc: state })
}

function handleSaveNotebook(state) {
  if (document.location.pathname ===  "/") {
    // Stops 404 that results from posting to `/.json` on the starter page
    return;
  }
  var raw_notebook = JSON.stringify(state)
  var data = {
    name: state.title,
    notebook: {
      name: state.title,
      body: raw_notebook,
    },
  };
  $.ajax({
    method: "PUT",
    url: document.location + ".json",
    data: JSON.stringify(data),
    complete: function(response, status) {
      // console.log("save response", response);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      // TODO handle errors
      console.log("Saving notebook failed:", textStatus);
    },
  });
}

function handleUpdateNotebook(state) {
}

// TODO - render onpushstate?

window.onpopstate = function(event) {
  render();
}

/*
function handleError(e) {
  console.log("ERROR:",e)
  let errors = {}
  errors[e.cell] = Object.assign({message: `${e.name}: ${e.message}`}, e);
  livebookStore.dispatch({ type: "NEW_ERRORS", data: errors });
}
*/

var Nav = require("./components/nav");
var Notebook = require("./components/notebook-flowing");
var Uploader = require("./components/uploader");


function renderUploader() {
  const isUploadPage = (window.location.pathname.indexOf("upload") !== -1)
  ReactDOM.render(<Uploader show={isUploadPage} startNewNotebook={startNewNotebook} />, uploaderMount);
}

function parseRawNotebook(raw_notebook,raw_csv) {
  let notebook = JSON.parse(raw_notebook)
  let state
  if (notebook.cells === undefined) {
    state = notebook
  } else {
    state = iPyToHTML(notebook);
  }
  livebookStore.dispatch({ type: "INITIALIZE_DOCUMENT", documentProps: state, editor: undefined })
  WORKER.postMessage({ type: "data", data: raw_csv, url: String(document.location), start: START })
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
    cradle.setSessionVar("color", randomColor())
    if (cradle.user.name == undefined) {
      cradle.setUserVar("name", randomName())
    } // else use old name
  })
}

function startNewNotebook(data) {
  postNotebookToServer(data.ipynb, data.csv, function() {
    parseRawNotebook(data.ipynb, data.csv);
    // I HOPE THIS WORKS
    update_peers_and_render();
  });
}

var exports =  {
  getCellPlots   : getCellPlots,
  getCurrentPage : () => CurrentPage,
  getEditor      : () => EDITOR,
};

if (/[/]d[/]([-\.a-zA-Z0-9]+)$/.test(document.location)) {
  $.get(document.location + ".json",function(data) {
    parseRawNotebook(data.Notebook.Body, data.DataFile.Body);
    render();
    startCradle()
  }, "json")
} else if (document.location.pathname.indexOf("/upload") === 0) {
  render();
}
else {
  document.location = "/fork/welcome"
}

module.exports = exports;
