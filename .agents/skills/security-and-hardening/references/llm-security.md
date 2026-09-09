# Securing AI / LLM Features

If your app calls an LLM — chatbots, summarizers, agents, RAG — it
inherits a new attack surface. Map it to the
[OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/):

- **Treat all model output as untrusted input (LLM05: Improper Output
  Handling).** Never pass LLM output straight into `eval`, SQL, a
  shell, `innerHTML`, or a file path. Validate and encode it exactly as
  you would raw user input.
- **Assume prompts can be hijacked (LLM01: Prompt Injection).**
  Untrusted text in the context window — a user message, a fetched web
  page, a PDF — can carry instructions. The system prompt is not a
  security boundary; enforce permissions in code, not in the prompt.
- **Keep secrets and other users' data out of prompts (LLM02 /
  LLM07).** Anything in the context can be echoed back. Don't put API
  keys, cross-tenant data, or the full system prompt where the model
  can repeat it.
- **Constrain tool and agent permissions (LLM06: Excessive Agency).**
  Scope tools to the minimum, require confirmation for destructive or
  irreversible actions, and validate every tool argument.
- **Bound consumption (LLM10: Unbounded Consumption).** Cap tokens,
  request rate, and loop/recursion depth so a crafted input can't run
  up cost or hang the system.
- **Isolate retrieval data (LLM08: Vector and Embedding Weaknesses).**
  In RAG, treat the vector store as a trust boundary: partition
  embeddings per tenant so one user can't retrieve another's data, and
  validate documents before indexing so poisoned content can't steer
  answers.

```typescript
// BAD: trusting model output as a command or as markup
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);                                   // arbitrary query execution
container.innerHTML = await llm.reply(userMessage);   // stored XSS, via the model

// GOOD: model output is data — parse defensively, then validate, then encode
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output'); // JSON.parse or schema failed
}
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```
