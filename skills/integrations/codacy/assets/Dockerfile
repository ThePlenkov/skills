FROM codacy/ci-base:3.0.4@sha256:3ea2e80bbe605273d78b01bd81b6e915c9339422e16218eed80706215118eb03
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash appuser
ENV PATH="/usr/lib/jvm/java-17-openjdk-amd64/bin:${PATH}"
# Keep writable output under /tmp (or another container path) instead of the
# mounted checkout to avoid UID/GID permission issues on Linux hosts.
USER appuser
HEALTHCHECK CMD java -version || exit 1
