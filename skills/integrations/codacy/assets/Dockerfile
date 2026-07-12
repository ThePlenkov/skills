FROM codacy/ci-base:latest
RUN apt-get update && apt-get install -y openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*
ENV PATH="/usr/lib/jvm/java-17-openjdk-amd64/bin:${PATH}"
