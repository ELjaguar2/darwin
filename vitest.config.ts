import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // Les worktrees des lots (.claude/worktrees) ne font pas partie de main.
    exclude: [...configDefaults.exclude, ".claude/**", "contracts/**"],
  },
});
