import { mount } from "enzyme";
import $ from "jquery";
import _ from "lodash";
import React from "react";
import { Provider } from "react-redux";

import { expect, it } from "@jest/globals";

import mockPopsicle from "../MockPopsicle";
import reduxUtils from "../redux-test-utils";
import { buildInnerHTML, tickUpdate, withGlobalJquery } from "../test-utils";

const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const originalInnerWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerWidth");
const originalInnerHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerHeight");

describe("DataViewer tests", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1205,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 775,
    });
    Object.defineProperty(global.document, "execCommand", { value: _.noop });

    const mockBuildLibs = withGlobalJquery(() =>
      mockPopsicle.mock(url => {
        const { urlFetcher } = require("../redux-test-utils").default;
        return urlFetcher(url);
      })
    );

    const mockChartUtils = withGlobalJquery(() => (ctx, cfg) => {
      const chartCfg = {
        ctx,
        cfg,
        data: cfg.data,
        destroyed: false,
      };
      chartCfg.destroy = function destroy() {
        chartCfg.destroyed = true;
      };
      return chartCfg;
    });

    jest.mock("popsicle", () => mockBuildLibs);
    jest.mock("chart.js", () => mockChartUtils);
    jest.mock("chartjs-plugin-zoom", () => ({}));
    jest.mock("chartjs-chart-box-and-violin-plot/build/Chart.BoxPlot.js", () => ({}));
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
    Object.defineProperty(window, "innerHeight", originalInnerHeight);
  });

  it("DataViewer: range selection", async () => {
    const { DataViewer, ReactDataViewer } = require("../../dtale/DataViewer");
    const { ReactGridEventHandler } = require("../../dtale/GridEventHandler");
    const GridCell = require("../../dtale/GridCell").ReactGridCell;
    const CopyRangeToClipboard = require("../../popups/CopyRangeToClipboard").ReactCopyRangeToClipboard;
    const store = reduxUtils.createDtaleStore();
    buildInnerHTML({ settings: "" }, store);
    const result = mount(
      <Provider store={store}>
        <DataViewer />
      </Provider>,
      {
        attachTo: document.getElementById("content"),
      }
    );
    await tickUpdate(result);
    let cellIdx = result.find(GridCell).at(20).find("div").prop("cell_idx");
    const instance = result.find(ReactGridEventHandler).instance();
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: cellIdx } } },
      shiftKey: true,
    });
    cellIdx = result.find(GridCell).last().find("div").prop("cell_idx");
    instance.handleMouseOver({
      target: { attributes: { cell_idx: { nodeValue: cellIdx } } },
      shiftKey: true,
    });
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: cellIdx } } },
      shiftKey: true,
    });
    result.update();
    expect(result.find(ReactDataViewer).instance().state.rangeSelect).toEqual({
      start: "3|3",
      end: "4|5",
    });
    const copyRange = result.find(CopyRangeToClipboard).first();
    expect(copyRange.instance().state.finalText).toBe("foo\t2000-01-01\nfoo\t\nfoo\t\n");
    copyRange.find("div.form-group").first().find("i").simulate("click");
    expect(copyRange.instance().state.finalText).toBe("col3\tcol4\nfoo\t2000-01-01\nfoo\t\nfoo\t\n");
    copyRange.instance().copy();
    expect(result.find(ReactDataViewer).instance().state.rangeSelect).toBeNull();
  });

  it("DataViewer: row range selection", async () => {
    const CopyRangeToClipboard = require("../../popups/CopyRangeToClipboard").ReactCopyRangeToClipboard;
    const text = "COPIED_TEXT";
    const postSpy = jest.spyOn($, "post");
    postSpy.mockImplementation((_url, _params, callback) => callback(text));
    const { DataViewer, ReactDataViewer } = require("../../dtale/DataViewer");
    const { ReactGridEventHandler } = require("../../dtale/GridEventHandler");
    const store = reduxUtils.createDtaleStore();
    buildInnerHTML({ settings: "" }, store);
    const result = mount(
      <Provider store={store}>
        <DataViewer />
      </Provider>,
      {
        attachTo: document.getElementById("content"),
      }
    );
    await tickUpdate(result);
    const instance = result.find(ReactGridEventHandler).instance();
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: "0|1" } } },
      shiftKey: true,
    });
    expect(result.find(ReactDataViewer).instance().state.rowRange).toEqual({
      start: 1,
      end: 1,
    });
    instance.handleMouseOver({
      target: { attributes: { cell_idx: { nodeValue: "0|2" } } },
      shiftKey: true,
    });
    expect(result.find(ReactDataViewer).instance().state.rowRange).toEqual({
      start: 1,
      end: 2,
    });
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: "0|2" } } },
      shiftKey: true,
    });
    result.update();
    const copyRange = result.find(CopyRangeToClipboard).first();
    expect(copyRange.instance().state.finalText).toBe(text);
    expect(postSpy).toBeCalledTimes(1);
    expect(postSpy).toBeCalledWith(
      "/dtale/build-row-copy/1",
      { start: 1, end: 2, columns: `["col1","col2","col3","col4"]` },
      expect.any(Function)
    );
    postSpy.mockRestore();
  });

  it("DataViewer: row ctrl selection", async () => {
    const { DataViewer, ReactDataViewer } = require("../../dtale/DataViewer");
    const { ReactGridEventHandler } = require("../../dtale/GridEventHandler");
    const store = reduxUtils.createDtaleStore();
    buildInnerHTML({ settings: "" }, store);
    const result = mount(
      <Provider store={store}>
        <DataViewer />
      </Provider>,
      {
        attachTo: document.getElementById("content"),
      }
    );
    await tickUpdate(result);
    const instance = result.find(ReactGridEventHandler).instance();
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: "0|1" } } },
      ctrlKey: true,
    });
    expect(result.find(ReactDataViewer).instance().state.ctrlRows).toEqual([1]);
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: "0|2" } } },
      ctrlKey: true,
    });
    expect(result.find(ReactDataViewer).instance().state.ctrlRows).toEqual([1, 2]);
    instance.handleClicks({
      target: { attributes: { cell_idx: { nodeValue: "0|1" } } },
      ctrlKey: true,
    });
    expect(result.find(ReactDataViewer).instance().state.ctrlRows).toEqual([2]);
  });
});
