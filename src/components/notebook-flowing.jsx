const React = require('react');
const ReactDOM = require('react-dom');
const Helmet = require('react-helmet');
const Uploader = require("./uploader.jsx");
const Editor = require('./notebook-flowing-editor');
const CodeCellV2 = require('./code-cell-v2');
const Collaborators = require("./collaborators");

const { eventFire, htmlDecode } = require("../util");

const CodeOverlaysContainer = React.createClass({

  componentDidMount() {
    this.props.handleOverlayMount();
    document.body.addEventListener("keydown", this.blurEditorOnEsc)
  },

  componentWillUnmount() {
    document.body.removeEventListener("keydown", this.blurEditorOnEsc)
  },

  blurEditorOnEsc({ which }) {
    let ESC = 27;
    if (which === ESC) {
      this.restoreMediumEditorCursor();
    }
  },

  restoreMediumEditorCursor() {
    this.props.focusOnSelectedOverlay();
  },

  doc() {
    return this.props.store.getState().doc
  },

  createCodeCell(id) {
    const doc    = this.doc();
    const code   = doc.codeMap[id];
    const result = doc.results[id];
    const plots  = doc.plots[id];
    const error  = doc.errors[id];
    return (
      <CodeCellV2
        key={id} index={id}
        result={result}
        code={code}
        error={error}
        plots={plots}
        store={this.props.store}
        focusEditorOnPlaceholder={this.props.focusEditorOnPlaceholder} />
    );
  },

  renderCodeCells() {
    return this.doc().codeList.map(this.createCodeCell);
  },

  render() {
    return (
      <div data-livebook-overlays="">
        {this.renderCodeCells()}
      </div>
    );
  }
});

const NotebookV2 = React.createClass({

  handleOverlayMount() {
    this.forceUpdate();
  },

  render() {
    const path = window.location.pathname;
    const isFullOfStuff = path !== "/" && path.indexOf("/upload") !== 0;

    if (isFullOfStuff) {
     return (
       <div className="notebook">{ this.renderEditorAndOverlays()}</div>
     ); 
    }

    return (
      <div className="notebook"></div>
    );
  },

  renderEditorAndOverlays() {
    let { title } = this.props.store.getState().doc;
    if (title.trim() ===  "<br>") {
      title = "(untitled notebook)";
    }
    else {
      title = htmlDecode(title);
    }

    return (
      <div className="editor-wrapper" data-livebook-editor-wrapper="true">
        <Helmet title={title} />
        <CodeOverlaysContainer
          store={this.props.store}
          handleOverlayMount={this.handleOverlayMount}
          focusOnSelectedOverlay={this.props.focusOnSelectedOverlay}
          focusEditorOnPlaceholder={this.props.focusEditorOnPlaceholder} />
        <Collaborators peers={this.props.getPeers()}/>
        <Editor
          store={this.props.store}
          assignForceUpdate={this.props.assignForceUpdate}
          assignFocusOnSelectedOverlay={this.props.assignFocusOnSelectedOverlay}
          assignFocusEditorOnPlaceholder={this.props.assignFocusEditorOnPlaceholder}/>
      </div>
    );
  }
});

module.exports = NotebookV2;
