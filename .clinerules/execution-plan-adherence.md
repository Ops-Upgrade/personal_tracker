## Brief overview
  Rules enforcing strict adherence to implementation plans and markdown instructions, including post-completion human action tracking. Applies globally across all workspaces.

## Plan adherence
  - When implementing any plan following a markdown file, strictly stick to the markdown instructions.
  - Do not deviate based on patterns or assumptions.
  - Always return to the markdown after each step to tick off completed items and read the next step to stay strictly on track.

## Post-implementation handoff
  - After completing an implementation plan, always generate a separate `human_actions.md` file listing all manual steps the human must perform after the automated work is done.
  - Manual steps include but are not limited to: environment variable setup, third-party account configuration, DNS changes, manual deployments, and license activations.