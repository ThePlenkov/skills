# gh-act Troubleshooting

Common failures and their fixes.

## Interactive prompt on first run

**Symptom**: `act` prompts for Docker image selection on first run.

**Fix**: create `.actrc` in the project root:

```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

## Docker not running

**Symptom**: `act` fails with "Cannot connect to Docker daemon".

**Fix**:
- Start Docker Desktop (Windows/macOS).
- Linux: `sudo systemctl start docker`.

## Image pull timeout

**Symptom**: Docker image download times out or is very slow.

**Fix**:
- Use a smaller image (Medium instead of Large).
- Check network connection.
- Use `--pull=false` to skip pull if the image already exists locally.

## Permission denied

**Symptom**: `act` fails with permission errors.

**Fix**:
- Add user to the docker group: `sudo usermod -aG docker $USER`.
- Alternatively, run with sudo (not recommended for daily use).

## Workflow not found

**Symptom**: `act` reports "no workflows found".

**Fix**:
- Verify `.github/workflows/` directory exists.
- Confirm workflow files have `.yml` or `.yaml` extension.
- Ensure workflows contain valid YAML.
