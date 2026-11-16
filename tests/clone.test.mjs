import { test } from "node:test";
import assert from "node:assert/strict";
import { pickClone } from "../web/js/core/clone.js";

test("the clone is the node that did not exist at the press, even when other nodes stay selected", () => {
  const before = new Set(["1", "2", "3"]);
  // A (1) was pressed with Alt while B (2) was selected too; the frontend made 4
  const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const selected = new Set(["2", "4"]);
  assert.equal(pickClone(before, nodes, selected).id, 4);
});

test("no new node means no clone (the frontend did not clone)", () => {
  assert.equal(pickClone(new Set(["1", "2"]), [{ id: 1 }, { id: 2 }], new Set(["2"])), null);
});

test("a new selected node is preferred over a new unselected one", () => {
  const nodes = [{ id: 1 }, { id: 5 }, { id: 6 }];
  assert.equal(pickClone(new Set(["1"]), nodes, new Set(["6"])).id, 6);
});
