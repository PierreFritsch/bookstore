---
name: create-branch
description: Personal preferences when creating branches
---

When starting work to document a bug,
ensure that my forked main branch is up-to-date with the upstream main branch
and create a branch based on my forked main.

The repo maintainers chose to install @sap/cds-dk globally. I prefer installing it locally with the zsh alias `cds=./node_modules/@sap/cds-dk/bin/cds.js`.
Before starting work, `npm install @sap/cds-dk --save` and save this change as a separate commit.