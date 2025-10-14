# Create a PR

- Ensure you're on an appropriate branch, if not create a new branch
- Check that the progress is updated in `docs/tickets/[ticket-id]/tasks.md` if there are no relevant items in the file, don't add them
- Update the `docs/ARCHITECTURE.md` for any MAJOR architectural changes made in this branch. Only do it if necessary
- Add an ADR in `docs/adr/` for any MAJOR architectural changes made in this branch. Only do it if necessary
- If you have been working off a specification in a `docs/tickets/[ticket-id]/specification.md`:
    - create a summary of the context and conversation in `docs/tickets/[ticket-id]/prompts.md` - remove any sensitive information or profanity
    - update the `docs/tickets/[ticket-id]/specification.md` with any relevant changes
    - update the `docs/tickets/[ticket-id]/tasks.md` with any relevant changes
- Commit the changes with a clear message
- Create the PR with a clear title and description. If a PR already exists, update it with the latest changes.
