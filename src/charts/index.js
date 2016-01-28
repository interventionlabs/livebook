const scatterV2 = require("./scatter-v2");
const plotTimeSeries = require("./time-series");
const isTimeSeries = plotTimeSeries.isTimeSeries;

const createClickForTooltip = require("./c3-click-for-tooltip");

function plotV2(selector, plot, { maxWidth }) {
  let { chart_type, layers } = plot;

  if (!layers || !layers.length) {
    throw new Error("plotV2 called with plot message that lacks layers");
  }

  if (chart_type === "scatter") {
    const chart = scatterV2(selector, layers[0], { maxWidth }); // fixme - only plotting first layer

    // This is what plotting multiple layers could look like:
    //    
    // const chart = scatterV2.layered(selector)
    // layers.forEach(chart.addLayer, chart)

    return chart;
  }

  if (chart_type === "line") {
    const data = layers[0].data;
    const chart = plotTimeSeries(selector, data, { maxWidth }); // fixme - only plotting first layer
    return chart;
  }

}

module.exports = { plotV2 }
