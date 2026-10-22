FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json requirements.txt ./
RUN npm ci \
  && python3 -m venv /opt/scholarx-python \
  && /opt/scholarx-python/bin/pip install --no-cache-dir -r requirements.txt

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PYTHON_PATH=/opt/scholarx-python/bin/python
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
