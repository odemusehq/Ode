import assert from "node:assert/strict";
import test from "node:test";
import { t } from "../shared/i18n";

test("the shared English catalogue resolves controls and literal request schemas", () => {
  assert.equal(t("common.save"), "Save");
  assert.equal(t("chat.messagePlaceholder"), "Message Ode…");
  assert.equal(t("common.initialVersion"), "Initial version");
  assert.equal(t("server.http.sendVersionIdWithTheId"), "Send { versionId } with the id of the change by Ode.");
});

test("library formatting preserves names and handles counts and optional clauses", () => {
  assert.equal(t("activity.stepCount", { count: 1 }), "1 step");
  assert.equal(t("activity.stepCount", { count: 3 }), "3 steps");
  const name = "Bass & drums <take 2>";
  assert.equal(t("chat.removeAttachment", { name }), `Remove ${name}`);
  assert.equal(t("history.restoreIncomplete", { moment: "12:30", skipped: "", hasSkipped: false }), "Restoring 12:30 was incomplete. Saved history remains available.");
  assert.equal(t("history.restoreIncomplete", { moment: "12:30", skipped: "automation", hasSkipped: true }), "Restoring 12:30 was incomplete: automation. Saved history remains available.");
});
