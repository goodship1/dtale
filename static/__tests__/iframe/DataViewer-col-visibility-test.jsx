import { mount } from "enzyme";
import $ from "jquery";
import React from "react";
import { Provider } from "react-redux";

import { expect, it } from "@jest/globals";

import mockPopsicle from "../MockPopsicle";
import reduxUtils from "../redux-test-utils";
import { buildInnerHTML, tickUpdate, withGlobalJquery } from "../test-utils";
import { clickColMenuButton, openColMenu, validateHeaders } from "./iframe-utils";

const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

describe("DataViewer iframe tests", () => {
  let result, DataViewer, ReactConfirmation, DataViewerInfo, postSpy;

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      value: 500,
    });

    const mockBuildLibs = withGlobalJquery(() =>
      mockPopsicle.mock(url => {
        const { urlFetcher } = require("../redux-test-utils").default;
        return urlFetcher(url);
      })
    );

    const mockChartUtils = withGlobalJquery(() => (ctx, cfg) => {
      const chartCfg = { ctx, cfg, data: cfg.data, destroyed: false };
      chartCfg.destroy = () => (chartCfg.destroyed = true);
      chartCfg.getElementsAtXAxis = _evt => [{ _index: 0 }];
      return chartCfg;
    });

    jest.mock("popsicle", () => mockBuildLibs);
    jest.mock("chart.js", () => mockChartUtils);
    jest.mock("chartjs-plugin-zoom", () => ({}));
    jest.mock("chartjs-chart-box-and-violin-plot/build/Chart.BoxPlot.js", () => ({}));
    DataViewer = require("../../dtale/DataViewer").DataViewer;
    ReactConfirmation = require("../../popups/Confirmation").ReactConfirmation;
    DataViewerInfo = require("../../dtale/DataViewerInfo").ReactDataViewerInfo;
  });

  beforeEach(async () => {
    postSpy = jest.spyOn($, "post");
    postSpy.mockImplementation((_url, _params, callback) => callback());
    const store = reduxUtils.createDtaleStore();
    buildInnerHTML({ settings: "", iframe: "True" }, store);
    result = mount(
      <Provider store={store}>
        <DataViewer />
      </Provider>,
      {
        attachTo: document.getElementById("content"),
      }
    );
    await tickUpdate(result);
  });

  afterEach(() => postSpy.mockRestore());

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  });

  it("DataViewer: deleting a column", async () => {
    await openColMenu(result, 3);
    clickColMenuButton(result, "Delete");
    result.find(ReactConfirmation).find("div.modal-footer").find("button").first().simulate("click");
    await tickUpdate(result);
    validateHeaders(result, ["col1", "col2", "col3"]);
  });

  it("DataViewer: hiding a column", async () => {
    await openColMenu(result, 3);
    clickColMenuButton(result, "Hide");
    result.update();
    expect(postSpy).toBeCalledTimes(1);
    const firstPostCall = postSpy.mock.calls[0];
    expect(firstPostCall[0]).toBe("/dtale/update-visibility/1");
    validateHeaders(result, ["col1", "col2", "col3"]);
    result.find(DataViewerInfo).find("div.col").last().find("i").simulate("click");
    result.update();
    expect(postSpy).toBeCalledTimes(2);
    validateHeaders(result, ["col1", "col2", "col3", "col4"]);
  });
});
