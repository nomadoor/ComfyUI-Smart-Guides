import { test } from "node:test";
import assert from "node:assert/strict";
import { createStatus } from "../web/js/app/status.js";

const quiet = () => {
  const lines = [];
  return { lines, warn: (...a) => lines.push(a.join(" ")) };
};

test("every feature starts ok", () => {
  const s = createStatus(quiet());
  assert.equal(s.get("snap"), "ok");
  assert.equal(s.isOff("snap"), false);
});

test("a few exceptions switch a feature off, others stay", () => {
  const log = quiet();
  const s = createStatus(log);
  s.fail("snap", new Error("a"));
  s.fail("snap", new Error("b"));
  assert.equal(s.isOff("snap"), false);
  s.fail("snap", new Error("c"));
  assert.equal(s.isOff("snap"), true);
  assert.equal(s.isOff("grid"), false);
  assert.equal(s.rows().snap.errors, 3);
});

test("off is final; fallback can return to ok", () => {
  const s = createStatus(quiet());
  s.report("nodeBoxes", "fallback", "x");
  s.report("nodeBoxes", "ok");
  assert.equal(s.get("nodeBoxes"), "ok");
  s.report("wireColor", "off", "gone");
  s.report("wireColor", "ok");
  assert.equal(s.get("wireColor"), "off");
});

test("a status is logged once, not on every report", () => {
  const log = quiet();
  const s = createStatus(log);
  s.report("toolboxButton", "fallback", "not found");
  s.report("toolboxButton", "fallback", "not found");
  assert.equal(log.lines.length, 1);
});

test("a clean run resets the count: only exceptions in a row switch a feature off", () => {
  const s = createStatus(quiet());
  s.fail("snap", new Error("a"));
  s.fail("snap", new Error("b"));
  s.clean("snap");
  s.fail("snap", new Error("c"));
  assert.equal(s.isOff("snap"), false);
});
