# n8n Self‑Hosting Guide (for Claude)

This playbook outlines supported options and step‑by‑step pointers to deploy n8n reliably, with links to official guides for each platform.

## 0) Decide your hosting path

- Fastest, managed: n8n Cloud (no install). If you're not experienced with servers, prefer Cloud. [[Choose n8n](https://docs.n8n.io/choose-n8n/#choose-your-n8n)]
- Self‑host options:
  - Docker or Docker Compose on a Linux server (recommended). [[Docker Installation](https://docs.n8n.io/hosting/installation/docker/#docker-installation); [Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#docker-compose)]
  - Server setup guides with Docker Compose (DigitalOcean, Hetzner, Heroku). [[Server setups](https://docs.n8n.io/hosting/installation/server-setups/#server-setups)]
  - Kubernetes (AWS EKS, Azure AKS, Google GKE) for scaling. [[AWS](https://docs.n8n.io/hosting/installation/server-setups/aws/#hosting-n8n-on-amazon-web-services); [Azure](https://docs.n8n.io/hosting/installation/server-setups/azure/#hosting-n8n-on-azure); [Google Cloud](https://docs.n8n.io/hosting/installation/server-setups/google-cloud/#hosting-n8n-on-google-cloud)]
  - PM2 (alternative, not the official default). [[PM2 setup](https://blog.n8n.io/how-to-set-up-n8n-via-pm2/)]

Self‑hosting requires skills in servers, security, scaling, and configuration. If unsure, use Cloud. [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n); [Choose n8n](https://docs.n8n.io/choose-n8n/#choose-your-n8n)]

---

## 1) Minimal local test (Docker, single node)

Use this to validate n8n runs before production.

- Install Docker/Compose. [[Docker Installation](https://docs.n8n.io/hosting/installation/docker/#docker-installation)]
- Start n8n:
  ```
  docker volume create n8n_data
  docker run -it --rm \
    --name n8n \
    -p 5678:5678 \
    -e GENERIC_TIMEZONE="<YOUR_TIMEZONE>" \
    -e TZ="<YOUR_TIMEZONE>" \
    -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    -e N8N_RUNNERS_ENABLED=true \
    -v n8n_data:/home/node/.n8n \
    docker.n8n.io/n8nio/n8n
  ```
  Then open http://localhost:5678. [[Docker Installation](https://docs.n8n.io/hosting/installation/docker/#docker-installation)]

---

## 2) Production on a VPS with Docker Compose

Recommended for most self‑host users.

A) Prereqs
- Linux VPS, domain/subdomain, Docker + Docker Compose installed. [[Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#docker-compose)]

B) DNS
- Create A record: subdomain → server IP (e.g., n8n.example.com). [[Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#3-dns-setup)]

C) Project and .env
- Create a working directory and .env:
  ```
  mkdir n8n-compose
  cd n8n-compose
  # .env (example)
  DOMAIN_NAME=example.com
  SUBDOMAIN=n8n
  GENERIC_TIMEZONE=Europe/Berlin
  SSL_EMAIL=user@example.com
  ```
  [[Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#4-create-an-env-file)]

D) Use an official Compose starter
- Use n8n's hosting repo templates (Caddy/Traefik options available per platform). [[Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#docker-compose)]
- For curated Caddy setups on DigitalOcean or Hetzner, follow these guides end‑to‑end (they clone n8n-docker-caddy and include SSL via Caddy):
  - DigitalOcean: create droplet with Docker image, add user, clone repo, configure, run. [[DigitalOcean](https://docs.n8n.io/hosting/installation/server-setups/digital-ocean/#hosting-n8n-on-digitalocean)]
  - Hetzner: create server with Docker CE image, install compose plugin, clone repo, create volumes, configure, run. [[Hetzner](https://docs.n8n.io/hosting/installation/server-setups/hetzner/#hosting-n8n-on-hetzner-cloud)]

E) Critical environment variables
- Set N8N_ENCRYPTION_KEY (required to encrypt account data).
- Set WEBHOOK_URL to your public URL (e.g., https://n8n.example.com). Required for webhooks to work correctly behind proxies. (Heroku guide highlights these; apply similarly.) [[Heroku](https://docs.n8n.io/hosting/installation/server-setups/heroku/#hosting-n8n-on-heroku)]

F) Start services
- Bring up via docker compose (per the chosen template's instructions). The Caddy/Traefik reverse proxy will handle TLS automatically if configured as in the guides. [[DigitalOcean](https://docs.n8n.io/hosting/installation/server-setups/digital-ocean/#hosting-n8n-on-digitalocean); [Hetzner](https://docs.n8n.io/hosting/installation/server-setups/hetzner/#hosting-n8n-on-hetzner-cloud)]

Tip: Community experience suggests small VPS plans (e.g., CPX11/CX11) can be sufficient for light workloads; SQLite is default, Postgres recommended as you grow. [[Activists VPS](https://blog.n8n.io/automations-for-activists/#option-1-virtual-private-server-vps-docker)]

---

## 3) Platform one‑clicks and Kubernetes

- Heroku (Docker + managed Postgres, "Deploy to Heroku"): set N8N_ENCRYPTION_KEY and WEBHOOK_URL, deploy, then map DNS if needed. [[Heroku](https://docs.n8n.io/hosting/installation/server-setups/heroku/#hosting-n8n-on-heroku)]
- Kubernetes for scaling:
  - AWS EKS: create cluster with eksctl, clone n8n-hosting repo, configure Postgres (PVC, secrets), deploy. [[AWS](https://docs.n8n.io/hosting/installation/server-setups/aws/#hosting-n8n-on-amazon-web-services)]
  - Azure AKS: create cluster, set kubectl context, clone n8n-hosting, configure Postgres PVC/secrets, deploy. [[Azure](https://docs.n8n.io/hosting/installation/server-setups/azure/#hosting-n8n-on-azure)]
  - Google GKE: create Standard cluster, set context, clone n8n-hosting, configure Postgres PVC/secrets, deploy. [[Google Cloud](https://docs.n8n.io/hosting/installation/server-setups/google-cloud/#hosting-n8n-on-google-cloud)]

Notes:
- The n8n-hosting repo provides manifests and structure; you replace secrets and adjust storage classes per guide. [[AWS](https://docs.n8n.io/hosting/installation/server-setups/aws/#hosting-n8n-on-amazon-web-services); [Azure](https://docs.n8n.io/hosting/installation/server-setups/azure/#hosting-n8n-on-azure); [Google Cloud](https://docs.n8n.io/hosting/installation/server-setups/google-cloud/#hosting-n8n-on-google-cloud)]

---

## 4) Post‑install essentials

- Authentication and users: choose auth mode, SSO/2FA for self‑hosted. [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n)]
- Environment variables: timezone, webhook URL, encryption key, runners, database, etc. [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n)]
- Security: SSL/HTTPS (handled by Caddy in DO/Hetzner guides), SSO/2FA, minimize exposure. [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n)]
- Scaling: enable queue mode with Redis and workers, or use runners; see scaling docs. [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n)]
- Upgrades: pull newer Docker image or update deployment; review breaking changes/changelog before upgrading. [[Activists VPS](https://blog.n8n.io/automations-for-activists/#option-1-virtual-private-server-vps-docker)]

---

## 5) Optional: Self‑hosted AI kit

Spin up n8n + local AI stack (Ollama, Qdrant, Postgres) via Docker Compose for private AI workflows; intended for demos/PoCs, customizable later. [[Self-hosted AI kit](https://blog.n8n.io/self-hosted-ai/)]

---

## 6) Alternative runtime: PM2

If you prefer Node.js process management on a VM, use PM2 (not the officially recommended default). The guide covers starting n8n, autostart on reboot, env vars, and optional Nginx/SSL. [[PM2 setup](https://blog.n8n.io/how-to-set-up-n8n-via-pm2/)]

---

## 7) Quick links hub

- Self‑hosting overview: [[Self-hosting](https://docs.n8n.io/hosting/#self-hosting-n8n)]
- Docker install: [[Docker Installation](https://docs.n8n.io/hosting/installation/docker/#docker-installation)]
- Docker Compose (generic): [[Docker-Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/#docker-compose)]
- DigitalOcean guide: [[DigitalOcean](https://docs.n8n.io/hosting/installation/server-setups/digital-ocean/#hosting-n8n-on-digitalocean)]
- Hetzner guide: [[Hetzner](https://docs.n8n.io/hosting/installation/server-setups/hetzner/#hosting-n8n-on-hetzner-cloud)]
- Heroku guide: [[Heroku](https://docs.n8n.io/hosting/installation/server-setups/heroku/#hosting-n8n-on-heroku)]
- AWS EKS: [[AWS](https://docs.n8n.io/hosting/installation/server-setups/aws/#hosting-n8n-on-amazon-web-services)]
- Azure AKS: [[Azure](https://docs.n8n.io/hosting/installation/server-setups/azure/#hosting-n8n-on-azure)]
- Google GKE: [[Google Cloud](https://docs.n8n.io/hosting/installation/server-setups/google-cloud/#hosting-n8n-on-google-cloud)]
- Choosing Cloud vs self‑host: [[Choose n8n](https://docs.n8n.io/choose-n8n/#choose-your-n8n)]

If you tell me your target platform (e.g., DigitalOcean with Caddy, or AWS EKS), I can turn the relevant section into a step‑by‑step command checklist.

