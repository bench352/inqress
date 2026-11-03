# Set up InQRess for your events

## Prerequisites

You'll need quite a bit of technical knowledge to set up InQRess for your events. Here's everything you need to know for a smooth setup:

- [Docker](https://www.docker.com/) containers and [Docker Compose](https://docs.docker.com/compose/)
- Linux and basic [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) terminal commands
- YAML files
- Basic networking and application hosting concepts (e.g. homelab / VPS / cloud)

If these are foreign to you, you may want help from someone more experienced with relevant domains instead.

## Device requirements

![](assets/devices.jpg)

InQRess needs multiple devices to work together. Make sure you have something that can fill each role:

| Role              | What it's for                                                             | Device needed                                                                                                                                                   | Recommended spec                                                                                                                                     | Recommended software                                                                                                                                                                       |
|-------------------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Admin             | Create / manage events, manage participants and tickets, track attendance | Any laptop / tablet / phone                                                                                                                                     | Anything that can run a modern browser                                                                                                               | Recent Chrome / Safari / Firefox                                                                                                                                                           |
| Server            | Hosts the InQRess instance                                                | Same computer as admin, a dedicated Windows / Linux PC (for self-hosting), or a cloud container hosting service (e.g. [AWS ECS](https://aws.amazon.com/pm/ecs)) | - ≥ 2-core CPU<br />- ≥ 2 GB RAM<br />- ≥ 10 GB free storage                                                                                         | Linux with Docker Engine / Windows with WSL + Docker Desktop                                                                                                                               |
| Companion Kiosk   | Shows scan results to guests and offers alternative check-in methods      | Tablet (Android / iPad) or a portable display connected to the admin's computer/laptop                                                                          | For tablets:<br />- ≥ 10" screen<br />- ≥ 2 GB RAM<br />For portable display:<br />- 1920×1080 resolution<br />- Must have touchscreen functionality | Android: [Webview Kiosk](https://github.com/nktnet1/webview-kiosk)<br>iPadOS: Safari / Chrome<br>Windows: Chrome in [kiosk mode](https://www.ninjaone.com/blog/what-is-chrome-kiosk-mode/) |
| Companion Scanner | Scans QR tickets                                                          | Android phone / iPhone                                                                                                                                          | - ≥ 2 GB RAM<br />- Rear camera with ≥ 1080p video recording and autofocus                                                                           | Android: Chrome / [Webview Kiosk](https://github.com/nktnet1/webview-kiosk)<br>iOS: Safari / Chrome                                                                                        |

## Installing InQRess

1. Create directories for the compose files and for your data:

   ```bash
   mkdir -p ~/inqress ~/.inqress
   ```

2. Download the release files into `~/inqress`:

   ```bash
   cd ~/inqress
   BASE=https://raw.githubusercontent.com/bench352/inqress/0.2.0/deploy
   curl -fsSLO "$BASE/docker-compose.yml"
   curl -fsSLO "$BASE/Caddyfile"
   curl -fsSLO "$BASE/config.yaml.example"
   ```

3. Copy and edit the example config:

   ```bash
   # Back up any existing config
   [ -f ~/.inqress/config.yaml ] && mv ~/.inqress/config.yaml ~/.inqress/config.yaml.bak
   cp ~/inqress/config.yaml.example ~/.inqress/config.yaml
   ```

   Edit `~/.inqress/config.yaml` and set a strong `auth.admin_username` and `auth.admin_password`.

   > [!NOTE]
   > If you are upgrading from V1, events and participants can be migrated automatically as long as the database file and key pairs remain in `~/.inqress`. You will still need to re-create your `config.yaml` settings manually.
   
4. Start InQRess:

   ```bash
   cd ~/inqress
   docker compose up -d
   ```

5. Open `http://localhost:8000` on the machine running Docker and log in with the credentials from step 3.

> [!IMPORTANT]
>
> Core features such as QR scanning require a [secure context](https://www.w3.org/TR/secure-contexts/). `localhost` is treated as secure, so the admin interface works over plain HTTP on the same machine. Companion devices (phones and tablets) need an HTTPS connection with a trusted certificate.
>
> In case you put InQRess behind a reverse proxy or load balancer for that exact purpose, make sure you set `auth.login_rate_limit.trusted_proxies` to the IP address or CIDR range that your reverse proxy or load balancer forwards requests from, so InQRess can interpret clients' requests appropriately and perform login rate limiting correctly.

## Optional: local HTTPS with the bundled Caddy proxy

The compose file also includes a Caddy proxy that provides HTTPS on your local network, so you can test device pairing and connectivity without setting up a certificate.

> [!WARNING]
> Browsers will show a certificate warning, which you can bypass in some browsers. This proxy is for testing only.

Here's how to set it up with the Caddy proxy:

1. Edit `~/inqress/Caddyfile` and replace `192.0.2.10` with the LAN IP or hostname your phones and tablets use to reach the server.

2. Make sure port 443 is open on the host, and that client isolation (the Wi-Fi setting that blocks devices from reaching each other) is off on your network.

3. Start InQRess with the `https` profile:

   ```bash
   cd ~/inqress
   docker compose --profile https up -d
   ```

4. On your phone or tablet, open `https://<host-ip-or-domain-of-your-server>` and continue past the certificate warning. Complete device pairing after you have created an event and participants.

To stop only the test proxy:

```bash
docker compose --profile https stop caddy
```

