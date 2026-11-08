import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { NeighborhoodMap } from "../components/NeighborhoodMap";

// Install jsdom in an isolated temporary folder; do not change app dependencies.
const requireDom = createRequire(join(process.env.DONGNE_MAP_TEST_DOM_ROOT || join(tmpdir(), "dongne-map-dom-test"), "package.json"));
const { JSDOM } = requireDom("jsdom");

test("repeated empty/category/selected transitions isolate SDK cleanup from React DOM", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID = "offline-test-public-id";
  let created = 0, destroyed = 0;
  const hosts: HTMLElement[] = [];
  dom.window.naver = { maps: {
    Map: class {
      constructor(private host: HTMLElement) {
        created++; hosts.push(host);
        host.appendChild(dom.window.document.createElement("strong"));
      }
      setCenter() {} setZoom() {} fitBounds() {}
      destroy() { destroyed++; this.host.replaceChildren(); }
    },
    LatLng: class {},
    Marker: class { setMap() {} setZIndex() {} },
    Event: { addListener() {} },
  } };
  const root = createRoot(dom.window.document.getElementById("root")!);
  const point = { id: "center", name: "센터", latitude: 37.45, longitude: 127.16 };
  const render = async (points: typeof point[], selected: string | null = null) => {
    await act(async () => { root.render(<React.StrictMode><NeighborhoodMap points={points} selectedPointId={selected} onSelectPoint={() => {}} /></React.StrictMode>); });
  };
  try {
    await render([]);
    const canvas = dom.window.document.querySelector(".neighborhood-map-canvas");
    assert.ok(canvas);
    for (let i = 0; i < 6; i++) {
      await render([point], point.id);
      assert.equal(dom.window.document.querySelector(".neighborhood-map-canvas"), canvas);
      const lastHost = hosts.at(-1)!;
      assert.equal(lastHost.parentNode, canvas);
      assert.notEqual(lastHost, canvas, "SDK may only mutate its own imperative child");
      await render([point, { ...point, id: "sports" }]);
      await render([]);
      assert.equal(dom.window.document.querySelector(".map-empty-state strong")?.textContent, "표시할 위치 정보가 없어요");
      assert.equal(lastHost.isConnected, false);
      assert.equal(canvas.childNodes.length, 0);
    }
    await render([point]);
    await act(async () => { dom.window.navermap_authFailure?.(); });
    assert.ok(dom.window.document.querySelector(".map-error"));
    assert.equal(dom.window.document.querySelector(".neighborhood-map-canvas"), canvas);
    assert.equal(dom.window.document.querySelectorAll('script[src*="naver"]').length, 0, "no external SDK request in this test");
  } finally {
    await act(async () => root.unmount());
    assert.equal(created, destroyed);
    if (originalId === undefined) delete process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    else process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID = originalId;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
