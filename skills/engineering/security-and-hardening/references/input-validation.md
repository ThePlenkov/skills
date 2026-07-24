# Input Validation Patterns

## Schema Validation at Boundaries

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

// Validate at the route handler
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten(),
      },
    });
  }
  // result.data is now typed and validated
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

## File Upload Safety

**Server-side signature/content validation is required.** Client-supplied
metadata (the `mimetype` field, the original filename, the extension)
is attacker-controlled and cannot be the primary defence. Use it only
as a hint; the safe baseline reads the file's magic bytes against the
expected signature and runs an anti-virus / content-disarm step
before persisting.

```typescript
// Restrict file types and sizes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
// Magic-byte signatures for the allowed types. The match is
// windowed to a specific offset range, NOT a fixed prefix —
// `image/webp` is a RIFF container, but so is `audio/wav`, so a
// plain `RIFF` prefix check accepts WAV files as WebP. The full
// WebP signature is `RIFF????WEBP`; we read 12 bytes and verify
// the four-byte type tag at offset 8.
const SIGNATURES: Array<{ mimetype: string; check: (head: Buffer) => boolean }> = [
  { mimetype: 'image/jpeg', check: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  {
    mimetype: 'image/png',
    check: (h) =>
      h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47 &&
      h[4] === 0x0d && h[5] === 0x0a && h[6] === 0x1a && h[7] === 0x0a,
  },
  {
    // RIFF????WEBP — the four bytes at offset 8 must spell WEBP,
    // which rules out RIFF/WAV (which spells WAVE) and any other
    // RIFF container.
    mimetype: 'image/webp',
    check: (h) =>
      h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
      h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50,
  },
];

async function validateUpload(file: UploadedFile): Promise<void> {
  if (file.size > MAX_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
  // 1. Open the file and read the first 12 bytes (enough for any
  //    of the signatures above).
  const head = await readFirstBytes(file.path, 12);
  // 2. Verify the file matches the claimed type's signature. If
  //    the file claims to be image/webp but the type tag at
  //    offset 8 is `WAVE` (or anything else), reject — it is not
  //    the type the client said.
  const expected = SIGNATURES.find((s) => s.mimetype === file.mimetype);
  if (!expected || !expected.check(head)) {
    throw new ValidationError('File content does not match claimed type');
  }
  // 3. Magic bytes are necessary but not sufficient: a file with
  //    a valid 4/8/12-byte prefix can still be garbage. Decode
  //    the full image with a trusted parser, then re-encode it
  //    from the decoded pixel data; if the parser throws, the
  //    file is malformed. (sharp / image / Pillow all do this
  //    under the hood; the round-trip catches "valid signature,
  //    invalid structure" payloads that would otherwise pass
  //    straight to disk.)
  await decodeAndReencode(file.path, file.mimetype);
  // 4. Run a content scan (clamd / VirusTotal / equivalent) for
  //    anything that survives the structural check. The mimetype,
  //    extension, and signature are no longer the primary defence.
  await scanForMalware(file.path);
}
```

The original (mimetype-only) check is **not safe** and is shown here
only to highlight what the previous recipe got wrong. The corrected
version: read magic bytes, match against a server-side allowlist,
**decode and re-encode through a trusted image parser**, then run a
content scan. The decode step rejects payloads that have a valid
signature but no parseable image structure — without it, a
`RIFF????WEBP<garbage>` blob passes the magic-byte check and lands in
storage.
