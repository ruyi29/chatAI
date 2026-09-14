# Product Notes

## MVP

ChatAI starts as a practical AI chat workspace:

- Create and switch conversations
- Stream assistant replies
- Store conversation history in MySQL
- Run with a mock AI provider before real model credentials are ready

## Next Milestones

1. User accounts and login
2. Real model provider configuration
3. File upload and document parsing
4. Knowledge-base retrieval
5. Tool calling and agent workflows

## Product Principles

- Keep the first screen usable, not promotional.
- Make the chat loop fast before adding advanced agent behavior.
- Keep provider logic behind a small service boundary.
- Store enough data for history and evaluation, but avoid logging secrets.

