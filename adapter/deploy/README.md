# BillDesk Static IP Adapter Deployment (DigitalOcean Droplet 64.225.85.27)

This directory contains deployment configuration to run the BillDesk adapter on the DigitalOcean host with static egress IP `64.225.85.27`.

## Architecture Overview
- **Service Process**: Node service listening strictly on loopback `127.0.0.1:3100`.
- **Egress**: Originates all upstream calls to BillDesk from whitelisted IP `64.225.85.27`.
- **Ingress**: Reverse-proxied via HTTPS (port 443) on an approved domain (e.g. `adapter.hakeemrestro.shop`).
- **Security**:
  - Restricts access strictly to authenticated calls via HMAC header signatures (`BILLDESK_ADAPTER_AUTH_SECRET`).
  - Strict route whitelisting: exposes ONLY `POST /uat/orders/create` and `POST /uat/transactions/get`.
  - Upstream calls disabled by default (`BILLDESK_UPSTREAM_ENABLED=false`).
  - Durable replay prevention using SQLite WAL mode at `/var/lib/billdesk-adapter/state.sqlite`.

---

## Deployment Steps on Droplet (`64.225.85.27`)

### 1. Create Service User and Directories
```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin billdesk-adapter
sudo mkdir -p /opt/billdesk-adapter /etc/billdesk-adapter /var/lib/billdesk-adapter
sudo chown -R billdesk-adapter:billdesk-adapter /opt/billdesk-adapter /etc/billdesk-adapter /var/lib/billdesk-adapter
sudo chmod 700 /var/lib/billdesk-adapter /etc/billdesk-adapter
```

### 2. Copy Adapter Files
Copy the `adapter/` folder and `package.json` to `/opt/billdesk-adapter/`:
```bash
# From local repository:
rsync -avz --exclude 'node_modules' adapter package.json root@64.225.85.27:/opt/billdesk-adapter/
```

### 3. Generate Auth Secret & Configure Environment
Generate a 32-byte random hex secret on the Droplet:
```bash
SECRET=$(openssl rand -hex 32)
sudo tee /etc/billdesk-adapter/adapter.env <<EOF
BILLDESK_ENV=UAT
BILLDESK_UPSTREAM_ENABLED=false
BILLDESK_ADAPTER_AUTH_KEY_ID=uat-adapter-key-1
BILLDESK_ADAPTER_AUTH_SECRET=$SECRET
BILLDESK_ADAPTER_STATE_PATH=/var/lib/billdesk-adapter/state.sqlite
EOF

sudo chmod 600 /etc/billdesk-adapter/adapter.env
sudo chown billdesk-adapter:billdesk-adapter /etc/billdesk-adapter/adapter.env
```
*(Copy the same `BILLDESK_ADAPTER_AUTH_KEY_ID` and `BILLDESK_ADAPTER_AUTH_SECRET` into local `.env.local`)*

### 4. Install and Start Systemd Service
```bash
sudo cp /opt/billdesk-adapter/adapter/deploy/billdesk-adapter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now billdesk-adapter
sudo systemctl status billdesk-adapter
```

### 5. Configure HTTPS Reverse Proxy (Nginx or Caddy)
Point your DNS (e.g. `adapter.hakeemrestro.shop` A record) to `64.225.85.27`.
Enable either Nginx or Caddy using the provided snippets in this folder.
