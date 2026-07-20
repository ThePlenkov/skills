FROM skills-harbor-devin-base:latest

USER root
COPY workspace/ /workspace/
RUN chown -R devin:devin /workspace

USER devin
WORKDIR /workspace
