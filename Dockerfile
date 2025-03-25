FROM bellingcat/auto-archiver:latest AS base


# install next.js
RUN git clone https://github.com/pjrobertson/auto-archiver-one-click.git && \
cd auto-archiver-one-click/frontend && \
npm install

RUN pip install auto-archiver-http-api